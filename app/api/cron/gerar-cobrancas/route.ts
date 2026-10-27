import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { bearerValido } from '@/lib/seguranca'
import { enviarAlerta } from '@/lib/alerta'
import { pagador } from '@/lib/responsavel'
import { criarCobrancaAsaas } from '@/lib/asaas-cobranca'
import { dataSaoPaulo, situacaoVencimento, jaTemCobranca, asaasLigado, MAX_DIAS_ATRASO_AUTOMATICO } from '@/lib/cobranca-regras'

export const runtime = 'nodejs'
export const maxDuration = 60

const DIAS_ANTECEDENCIA = 10

/**
 * Roda 1x por dia (Vercel Cron). Faz duas coisas:
 *  1) marca como "Atrasado" os pagamentos pendentes já vencidos;
 *  2) gera a cobrança Asaas dos alunos ativos cujo vencimento cai nos próximos 10 dias
 *     OU que já venceram (até 90 dias) e ainda não têm cobrança em aberto.
 * Com ?simular=1 só mostra o que faria, sem gravar nada nem chamar o Asaas.
 * Autenticação: header Authorization: Bearer CRON_SECRET (a Vercel envia sozinha).
 */
export async function GET(request: NextRequest) {
  if (!bearerValido(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const simular = request.nextUrl.searchParams.get('simular') === '1'
  const db = getSupabaseAdmin()
  const hoje = dataSaoPaulo()
  const limite = dataSaoPaulo(DIAS_ANTECEDENCIA)

  // 1) Pagamentos pendentes vencidos viram "Atrasado" (a tela Em atraso lê este status)
  let marcadosAtrasados = 0
  if (simular) {
    const { count } = await db
      .from('pagamentos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pendente')
      .lt('data_vencimento', hoje)
    marcadosAtrasados = count ?? 0
  } else {
    const { data, error } = await db
      .from('pagamentos')
      .update({ status: 'Atrasado' })
      .eq('status', 'Pendente')
      .lt('data_vencimento', hoje)
      .select('id')
    if (error) console.error('[cron] erro ao marcar atrasados:', error)
    marcadosAtrasados = data?.length ?? 0
  }

  // Trava de segurança: a geração automática de cobranças só roda com ASAAS_ATIVO=sim na Vercel.
  // Sem isso (o padrão), nada é cobrado nem enviado ao Asaas — só o passo 1 acima acontece.
  if (!simular && !asaasLigado(process.env.ASAAS_ATIVO)) {
    return NextResponse.json({ ok: true, cobrancaAutomatica: 'desligada', marcadosAtrasados })
  }

  // 2) Alunos ativos com vencimento até o limite (inclui os já vencidos)
  const { data: alunos, error } = await db
    .from('alunos')
    .select('id, nome, cpf, data_vencimento, responsavel_nome, responsavel_cpf, responsavel_celular')
    .eq('status', 'Ativo')
    .not('data_vencimento', 'is', null)
    .lte('data_vencimento', limite)
  if (error) {
    console.error('[cron] erro ao listar alunos:', error)
    return NextResponse.json({ error: 'Erro ao listar alunos' }, { status: 500 })
  }

  const geradas: { aluno: string; vencimento: string; atrasado: boolean }[] = []
  const ignorados: { aluno: string; motivo: string }[] = []
  const falhas: { aluno: string; erro: string }[] = []

  for (const aluno of alunos ?? []) {
    try {
      const situacao = situacaoVencimento(aluno.data_vencimento, hoje, limite)
      if (situacao === 'fora_da_janela') continue
      if (situacao === 'atrasado_demais') {
        ignorados.push({ aluno: aluno.nome, motivo: `atrasado há mais de ${MAX_DIAS_ATRASO_AUTOMATICO} dias: conferir na mão` })
        continue
      }
      const atrasado = situacao === 'atrasado'

      const { data: pagamentos } = await db
        .from('pagamentos')
        .select('data_vencimento, status')
        .eq('aluno_id', aluno.id)
      if (jaTemCobranca(pagamentos ?? [], aluno.data_vencimento, atrasado)) continue

      const { data: mats } = await db.from('matriculas').select('valor').eq('aluno_id', aluno.id)
      const total = (mats ?? []).reduce((acc, m) => acc + (m.valor ?? 0), 0)
      if (total <= 0) {
        ignorados.push({ aluno: aluno.nome, motivo: 'sem matrícula com valor' })
        continue
      }
      if (!pagador(aluno).cpf) {
        ignorados.push({ aluno: aluno.nome, motivo: 'sem CPF (de quem paga)' })
        continue
      }

      if (simular) {
        geradas.push({ aluno: aluno.nome, vencimento: aluno.data_vencimento, atrasado })
        continue
      }

      const { data: novo, error: insError } = await db
        .from('pagamentos')
        .insert({
          aluno_id: aluno.id,
          valor: total,
          data_vencimento: aluno.data_vencimento,
          competencia: String(aluno.data_vencimento).slice(0, 7),
          status: atrasado ? 'Atrasado' : 'Pendente',
        })
        .select('id')
        .single()
      if (insError || !novo) throw new Error('não foi possível criar o pagamento')

      try {
        await criarCobrancaAsaas(db, novo.id)
      } catch (e) {
        await db.from('pagamentos').delete().eq('id', novo.id)
        throw e
      }


      geradas.push({ aluno: aluno.nome, vencimento: aluno.data_vencimento, atrasado })
    } catch (e) {
      console.error('[cron] falha ao gerar cobrança de', aluno.nome, e)
      falhas.push({ aluno: aluno.nome, erro: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!simular && falhas.length > 0) {
    await enviarAlerta({
      origem: 'Cobranças automáticas',
      mensagem: `${falhas.length} cobrança(s) não foram geradas hoje: ${falhas.map(x => x.aluno).join(', ')}`,
      detalhe: falhas[0].erro,
    })
  }

  console.log(`[cron] simular=${simular} atrasados marcados: ${marcadosAtrasados}, geradas: ${geradas.length}, ignorados: ${ignorados.length}, falhas: ${falhas.length}`)
  return NextResponse.json({ success: true, simular, hoje, limite, marcadosAtrasados, geradas, ignorados, falhas })
}
