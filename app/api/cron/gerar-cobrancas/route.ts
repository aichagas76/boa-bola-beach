import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { criarCobrancaAsaas } from '@/lib/asaas-cobranca'

export const runtime = 'nodejs'
export const maxDuration = 60

const DIAS_ANTECEDENCIA = 10

function dataSaoPaulo(somarDias = 0) {
  const d = new Date(Date.now() + somarDias * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Roda 1x por dia (Vercel Cron). Gera a cobrança Asaas dos alunos ativos cujo
 * vencimento cai nos próximos 10 dias e que ainda não têm cobrança desse vencimento.
 * Autenticação: header Authorization: Bearer CRON_SECRET (a Vercel envia sozinha).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const hoje = dataSaoPaulo()
  const limite = dataSaoPaulo(DIAS_ANTECEDENCIA)

  const { data: alunos, error } = await db
    .from('alunos')
    .select('id, nome, cpf, data_vencimento')
    .eq('status', 'Ativo')
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', limite)
  if (error) {
    console.error('[cron] erro ao listar alunos:', error)
    return NextResponse.json({ error: 'Erro ao listar alunos' }, { status: 500 })
  }

  const geradas: string[] = []
  const ignorados: { aluno: string; motivo: string }[] = []
  const falhas: { aluno: string; erro: string }[] = []

  for (const aluno of alunos ?? []) {
    try {
      const { data: existente } = await db
        .from('pagamentos')
        .select('id')
        .eq('aluno_id', aluno.id)
        .eq('data_vencimento', aluno.data_vencimento)
        .limit(1)
      if (existente && existente.length > 0) continue

      const { data: mats } = await db.from('matriculas').select('valor').eq('aluno_id', aluno.id)
      const total = (mats ?? []).reduce((acc, m) => acc + (m.valor ?? 0), 0)
      if (total <= 0) {
        ignorados.push({ aluno: aluno.nome, motivo: 'sem matrícula com valor' })
        continue
      }
      if (!aluno.cpf) {
        ignorados.push({ aluno: aluno.nome, motivo: 'sem CPF' })
        continue
      }

      const { data: novo, error: insError } = await db
        .from('pagamentos')
        .insert({
          aluno_id: aluno.id,
          valor: total,
          data_vencimento: aluno.data_vencimento,
          competencia: String(aluno.data_vencimento).slice(0, 7),
          status: 'Pendente',
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

      // Novo ciclo: libera os avisos de WhatsApp de novo
      await db
        .from('alunos')
        .update({
          aviso_3dias: 'NAO',
          aviso_vencimento: 'NAO',
          aviso_3dias_atraso: 'NAO',
          aviso_6dias_atraso: 'NAO',
        })
        .eq('id', aluno.id)

      geradas.push(aluno.nome)
    } catch (e) {
      console.error('[cron] falha ao gerar cobrança de', aluno.nome, e)
      falhas.push({ aluno: aluno.nome, erro: e instanceof Error ? e.message : String(e) })
    }
  }

  console.log(`[cron] cobranças geradas: ${geradas.length}, ignorados: ${ignorados.length}, falhas: ${falhas.length}`)
  return NextResponse.json({ success: true, hoje, limite, geradas, ignorados, falhas })
}
