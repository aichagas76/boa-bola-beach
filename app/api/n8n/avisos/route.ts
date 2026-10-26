import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { bearerValido } from '@/lib/seguranca'
import { sinalAviso, type RegistroAviso } from '@/lib/avisos-regras'
import { pagador } from '@/lib/responsavel'

export const runtime = 'nodejs'

function autorizadoN8n(request: NextRequest) {
  return bearerValido(request.headers.get('authorization'), process.env.N8N_API_TOKEN)
}

function dataBR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Lista, no mesmo formato da planilha "Cadastro" usada pelo fluxo do n8n, os alunos
 * ativos que têm cobrança em aberto com link. O n8n continua decidindo quem recebe
 * cada aviso (3 dias antes, no dia, 3 e 6 dias depois) com o filtro que já existe;
 * o que já foi enviado (SIM) ou falhou 3 vezes (ERRO) vem de avisos_whatsapp.
 */
export async function GET(request: NextRequest) {
  if (!autorizadoN8n(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = getSupabaseAdmin()

  const { data: pagamentos, error } = await db
    .from('pagamentos')
    .select('id, aluno_id, valor, data_vencimento, link_pagamento, id_cobranca_asaas, status')
    .neq('status', 'Pago')
    .neq('status', 'Cancelado')
    .not('link_pagamento', 'is', null)
    .not('data_vencimento', 'is', null)
    .order('data_vencimento', { ascending: false })
  if (error) {
    console.error('[n8n/avisos] erro:', error)
    return NextResponse.json({ error: 'Erro ao listar cobranças' }, { status: 500 })
  }

  // Uma cobrança por aluno: a de vencimento mais recente que ainda está em aberto
  const porAluno = new Map<string, NonNullable<typeof pagamentos>[number]>()
  for (const p of pagamentos ?? []) {
    if (p.aluno_id && !porAluno.has(p.aluno_id)) porAluno.set(p.aluno_id, p)
  }
  if (porAluno.size === 0) return NextResponse.json([])

  const { data: alunos } = await db
    .from('alunos')
    .select('id, nome, celular, status, responsavel_nome, responsavel_celular')
    .in('id', Array.from(porAluno.keys()))

  const { data: avisos, error: avisosError } = await db
    .from('avisos_whatsapp')
    .select('pagamento_id, tipo, resultado, tentativas')
    .in('pagamento_id', Array.from(porAluno.values()).map(p => p.id))
  if (avisosError) {
    // Melhor parar do que reenviar mensagens que já foram
    console.error('[n8n/avisos] erro ao ler avisos_whatsapp:', avisosError)
    return NextResponse.json({ error: 'Erro ao ler avisos enviados' }, { status: 500 })
  }
  const registro = new Map<string, RegistroAviso>()
  for (const a of avisos ?? []) {
    registro.set(`${a.pagamento_id}:${a.tipo}`, { resultado: a.resultado, tentativas: a.tentativas })
  }

  const lista = (alunos ?? [])
    .filter(a => a.status === 'Ativo' && pagador(a).celular)
    .map(a => {
      const p = porAluno.get(a.id)!
      const sinal = (tipo: string) => sinalAviso(registro.get(`${p.id}:${tipo}`))
      return {
        RowId: a.id,
        Nome: pagador(a).nome, // com responsável, o aviso vai para ele
        NomeAluno: a.nome,
        Celular: pagador(a).celular,
        Status: 'ATIVO',
        StatusPagamento: 'Pendente',
        DataVencimento: dataBR(p.data_vencimento),
        ValorAsaas: Number(p.valor),
        LinkPix: p.link_pagamento,
        IdCobrancaAsaas: p.id_cobranca_asaas,
        Aviso3DiasEnviado: sinal('3dias'),
        AvisoVencimentoEnviado: sinal('vencimento'),
        Aviso3DiasAtraso: sinal('3diasAtraso'),
        Aviso6DiasAtraso: sinal('6diasAtraso'),
      }
    })

  return NextResponse.json(lista)
}
