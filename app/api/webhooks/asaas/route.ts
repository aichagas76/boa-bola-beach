import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { textoIgual } from '@/lib/seguranca'
import { enviarAlerta } from '@/lib/alerta'
import { dataSaoPaulo } from '@/lib/cobranca-regras'
import { decidirWebhook, somarUmMes } from '@/lib/webhook-regras'

export const runtime = 'nodejs'

// Rótulo da forma de pagamento quando a cobrança é paga pelo Asaas
const FORMA_ASAAS: Record<string, string> = {
  PIX: 'PIX Asaas',
  BOLETO: 'Boleto Asaas',
  CREDIT_CARD: 'Cartão Asaas',
  DEBIT_CARD: 'Cartão Asaas',
}

type Db = ReturnType<typeof getSupabaseAdmin>

/** Deixa um aviso na tela de Logs para a equipe conferir (o webhook em si responde 200). */
async function avisarEquipe(db: Db, acao: string, paymentId: string, detalhes: string) {
  const { error } = await db
    .from('logs')
    .insert({ usuario_email: 'Asaas', acao, tabela: 'pagamentos', registro_id: paymentId, detalhes })
  if (error) console.error('Erro ao gravar log do webhook:', error)
}

export async function POST(request: NextRequest) {
  // Token configurado no painel do Asaas (obrigatório: sem ele o webhook recusa tudo)
  if (!textoIgual(request.headers.get('asaas-access-token'), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { event, payment } = await request.json()
    if (!event || !payment?.id) {
      return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
    }

    const db = getSupabaseAdmin()

    const { data: achados, error: buscaError } = await db
      .from('pagamentos')
      .select('id, aluno_id, valor, status')
      .eq('id_cobranca_asaas', payment.id)
      .limit(1)
    if (buscaError) {
      console.error('Erro ao buscar pagamento do webhook:', buscaError)
      return NextResponse.json({ error: 'Erro ao buscar pagamento' }, { status: 500 })
    }
    const pagamento = achados?.[0]
    if (!pagamento) {
      // Responde 200 para o Asaas não ficar reenviando, mas deixa rastro
      console.warn(`[Asaas Webhook] ${event} ${payment.id}: cobrança não existe no sistema`)
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        await avisarEquipe(db, 'Pagamento Asaas sem cobrança no sistema', payment.id, `${event} R$ ${payment.value}: lançar na mão`)
      }
      return NextResponse.json({ success: true, ignored: 'cobranca_desconhecida' })
    }

    const acao = decidirWebhook(event, Number(payment.value), pagamento)

    if (acao.tipo === 'ignorar') {
      if (acao.motivo.includes('conferir')) await avisarEquipe(db, 'Webhook Asaas: conferir', payment.id, `${event}: ${acao.motivo}`)
      return NextResponse.json({ success: true, ignored: acao.motivo })
    }

    if (acao.tipo === 'marcar') {
      const { error } = await db.from('pagamentos').update({ status: acao.status }).eq('id', pagamento.id)
      if (error) throw error
      console.log(`[Asaas Webhook] ${event} ${payment.id} -> ${acao.status}`)
      return NextResponse.json({ success: true })
    }

    if (acao.tipo === 'estornar') {
      const { error } = await db
        .from('pagamentos')
        .update({ status: 'Pendente', data_pagamento: null, valor_pago: null })
        .eq('id', pagamento.id)
      if (error) throw error
      await db.from('movimentacoes').update({ status: 'Estornado' }).eq('id_cobranca_asaas', payment.id)
      await avisarEquipe(db, 'Estorno no Asaas', payment.id, 'Entrada marcada como Estornado. Conferir o vencimento do aluno (não é revertido sozinho).')
      return NextResponse.json({ success: true })
    }

    // --- Pagamento recebido ---
    const formaPagamento = FORMA_ASAAS[payment.billingType] ?? 'Asaas'
    const dataPagamento: string = payment.paymentDate || payment.confirmedDate || dataSaoPaulo()
    const { valorPago, parcial } = acao

    // Pagamento parcial: registra o valor, mas a cobrança continua em aberto
    const { error: upError } = await db
      .from('pagamentos')
      .update(
        parcial
          ? { valor_pago: valorPago, meio_pagamento: formaPagamento, id_pagamento_asaas: payment.id }
          : {
              status: 'Pago',
              data_pagamento: dataPagamento,
              valor_pago: valorPago,
              meio_pagamento: formaPagamento,
              id_pagamento_asaas: payment.id,
            }
      )
      .eq('id', pagamento.id)
    if (upError) throw upError

    // Lança a entrada no financeiro (as telas leem de movimentacoes), sem duplicar
    const { data: existente } = await db
      .from('movimentacoes')
      .select('id, descricao, status')
      .eq('id_cobranca_asaas', payment.id)
      .limit(1)
    const jaLancada = existente?.[0]
    const reaproveitar = jaLancada?.status === 'Estornado' || !!jaLancada?.descricao?.toLowerCase().includes('parcial')
    if (jaLancada && !reaproveitar) return NextResponse.json({ success: true, ignored: 'ja_lancado' })

    const lancamento = {
      tipo: 'Entrada',
      descricao: parcial ? 'Pagamento parcial Asaas' : 'Cobrança Asaas',
      valor: valorPago,
      forma_pagamento: formaPagamento,
      data: dataPagamento,
      data_pagamento: dataPagamento,
      data_vencimento: payment.dueDate ?? null,
      status: 'Recebido',
      aluno_ref_id: pagamento.aluno_id,
      origem: 'Asaas',
      id_cobranca_asaas: payment.id,
    }
    const { error: movError } = jaLancada
      ? await db.from('movimentacoes').update(lancamento).eq('id', jaLancada.id)
      : await db.from('movimentacoes').insert(lancamento)
    if (movError) {
      // 23505 = o mesmo evento chegou duas vezes ao mesmo tempo; a outra chamada já lançou
      if (movError.code === '23505') return NextResponse.json({ success: true, ignored: 'ja_lancado' })
      console.error('Erro ao lançar entrada via webhook:', movError)
      return NextResponse.json({ error: 'Erro ao lançar entrada' }, { status: 500 })
    }

    if (parcial) {
      await avisarEquipe(db, 'Pagamento parcial no Asaas', payment.id, `Recebido R$ ${valorPago} de R$ ${pagamento.valor}. Cobrança segue em aberto.`)
      return NextResponse.json({ success: true, parcial: true })
    }

    // Pagamento total: avança o vencimento do aluno em 1 mês (igual ao pagamento manual)
    const { data: mats } = await db.from('matriculas').select('valor').eq('aluno_id', pagamento.aluno_id)
    const totalMats = (mats ?? []).reduce((acc, m) => acc + (m.valor ?? 0), 0)
    if (totalMats > 0 && valorPago >= totalMats) {
      const { data: aluno } = await db
        .from('alunos')
        .select('data_vencimento')
        .eq('id', pagamento.aluno_id)
        .single()
      if (aluno?.data_vencimento) {
        await db
          .from('alunos')
          .update({ data_vencimento: somarUmMes(aluno.data_vencimento) })
          .eq('id', pagamento.aluno_id)
      }
    }

    console.log(`[Asaas Webhook] ${event} ${payment.id} -> Pago`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar webhook Asaas:', error)
    await enviarAlerta({ origem: 'Webhook do Asaas', mensagem: 'Um aviso de pagamento do Asaas falhou. O Asaas tenta de novo sozinho; se persistir, conferir.', detalhe: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}
