import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { bearerValido } from '@/lib/seguranca'
import { aplicarResultado, tipoValido, MAX_TENTATIVAS, type RegistroAviso } from '@/lib/avisos-regras'
import { enviarAlerta } from '@/lib/alerta'

export const runtime = 'nodejs'

/**
 * O n8n chama depois de cada tentativa de envio para registrar o resultado (SIM ou ERRO).
 * Falha volta a ser tentada nos próximos ciclos; na 3ª falha o sistema desiste e avisa o dono.
 * Body: { RowId (id do aluno), tipoAviso, resultado, erro? }
 */
export async function POST(request: NextRequest) {
  if (!bearerValido(request.headers.get('authorization'), process.env.N8N_API_TOKEN)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { RowId, tipoAviso, resultado, erro } = await request.json()
  if (!RowId || !tipoValido(tipoAviso) || !['SIM', 'ERRO'].includes(resultado)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // A cobrança em aberto do aluno (a mesma que o n8n recebeu na listagem)
  const { data: pags } = await db
    .from('pagamentos')
    .select('id')
    .eq('aluno_id', RowId)
    .neq('status', 'Pago')
    .neq('status', 'Cancelado')
    .not('link_pagamento', 'is', null)
    .not('data_vencimento', 'is', null)
    .order('data_vencimento', { ascending: false })
    .limit(1)
  const pagamentoId = pags?.[0]?.id
  if (!pagamentoId) {
    return NextResponse.json({ error: 'Aluno sem cobrança em aberto' }, { status: 404 })
  }

  const { data: atual } = await db
    .from('avisos_whatsapp')
    .select('resultado, tentativas')
    .eq('pagamento_id', pagamentoId)
    .eq('tipo', tipoAviso)
    .maybeSingle()

  const novo = aplicarResultado((atual as RegistroAviso | null) ?? undefined, resultado)
  const { error } = await db.from('avisos_whatsapp').upsert(
    {
      pagamento_id: pagamentoId,
      aluno_id: RowId,
      tipo: tipoAviso,
      resultado: novo.resultado,
      tentativas: novo.tentativas,
      ultimo_erro: resultado === 'ERRO' ? String(erro ?? 'falha no envio').slice(0, 300) : null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'pagamento_id,tipo' }
  )
  if (error) {
    console.error('[n8n/avisos/marcar] erro:', error)
    return NextResponse.json({ error: 'Erro ao registrar aviso' }, { status: 500 })
  }

  if (novo.desistiu) {
    const { data: aluno } = await db.from('alunos').select('nome').eq('id', RowId).maybeSingle()
    await enviarAlerta({
      origem: 'Aviso de WhatsApp',
      mensagem: `Não consegui avisar ${aluno?.nome ?? 'um aluno'} (${tipoAviso}) depois de ${MAX_TENTATIVAS} tentativas. Conferir o número e mandar na mão.`,
      detalhe: String(erro ?? ''),
    })
  }

  return NextResponse.json({ success: true, tentativas: novo.tentativas, desistiu: novo.desistiu })
}
