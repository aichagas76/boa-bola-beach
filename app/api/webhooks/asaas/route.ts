import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Evento Asaas -> status usado no app (pagamentos: Pago/Pendente/Atrasado)
const EVENT_STATUS: Record<string, string> = {
  PAYMENT_RECEIVED: 'Pago',
  PAYMENT_CONFIRMED: 'Pago',
  PAYMENT_OVERDUE: 'Atrasado',
  PAYMENT_RESTORED: 'Pendente',
  PAYMENT_REFUNDED: 'Pendente',
}

// Rótulo da forma de pagamento quando a cobrança é paga pelo Asaas
const FORMA_ASAAS: Record<string, string> = {
  PIX: 'PIX Asaas',
  BOLETO: 'Boleto Asaas',
  CREDIT_CARD: 'Cartão Asaas',
  DEBIT_CARD: 'Cartão Asaas',
}

export async function POST(request: NextRequest) {
  // Token configurado no painel do Asaas (opcional, mas recomendado)
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (expected && request.headers.get('asaas-access-token') !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { event, payment } = await request.json()
    if (!event || !payment?.id) {
      return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
    }

    const status = EVENT_STATUS[event]
    if (!status) return NextResponse.json({ success: true, ignored: event })

    const db = getSupabaseAdmin()
    const pago = status === 'Pago'
    const formaPagamento = FORMA_ASAAS[payment.billingType] ?? 'Asaas'
    const dataPagamento = pago
      ? payment.paymentDate || payment.confirmedDate || new Date().toLocaleDateString('en-CA')
      : null

    const { data, error } = await db
      .from('pagamentos')
      .update({
        status,
        data_pagamento: dataPagamento,
        valor_pago: pago ? payment.value : null,
        meio_pagamento: formaPagamento,
        id_pagamento_asaas: payment.id,
      })
      .eq('id_cobranca_asaas', payment.id)
      .select('aluno_id, valor')

    if (error) {
      console.error('Erro ao atualizar pagamento via webhook:', error)
      return NextResponse.json({ error: 'Erro ao atualizar pagamento' }, { status: 500 })
    }

    // Lança a entrada no financeiro (as telas leem de movimentacoes), sem duplicar
    if (pago && data && data.length > 0) {
      const { data: existente } = await db
        .from('movimentacoes')
        .select('id')
        .eq('id_cobranca_asaas', payment.id)
        .limit(1)

      if (!existente || existente.length === 0) {
        const { error: movError } = await db.from('movimentacoes').insert({
          tipo: 'Entrada',
          descricao: 'Cobrança Asaas',
          valor: payment.value ?? data[0].valor,
          forma_pagamento: formaPagamento,
          data: dataPagamento,
          data_pagamento: dataPagamento,
          data_vencimento: payment.dueDate ?? null,
          status: 'Recebido',
          aluno_ref_id: data[0].aluno_id,
          origem: 'Asaas',
          id_cobranca_asaas: payment.id,
        })
        if (movError) {
          console.error('Erro ao lançar entrada via webhook:', movError)
          return NextResponse.json({ error: 'Erro ao lançar entrada' }, { status: 500 })
        }

        // Pagamento total: avança o vencimento do aluno em 1 mês (igual ao pagamento manual)
        const alunoId = data[0].aluno_id
        const { data: mats } = await db.from('matriculas').select('valor').eq('aluno_id', alunoId)
        const totalMats = (mats ?? []).reduce((acc, m) => acc + (m.valor ?? 0), 0)
        const valorPago = Number(payment.value ?? data[0].valor)
        if (totalMats > 0 && valorPago >= totalMats) {
          const { data: aluno } = await db
            .from('alunos')
            .select('data_vencimento')
            .eq('id', alunoId)
            .single()
          if (aluno?.data_vencimento) {
            const [y, m, d] = aluno.data_vencimento.split('-').map(Number)
            const proximo = new Date(Date.UTC(y, m, d)) // mês seguinte (m já é base 1)
            await db
              .from('alunos')
              .update({ data_vencimento: proximo.toISOString().split('T')[0] })
              .eq('id', alunoId)
          }
        }
      }
    }

    console.log(`[Asaas Webhook] ${event} ${payment.id} -> ${status}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar webhook Asaas:', error)
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}
