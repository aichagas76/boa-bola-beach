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
    const dataPagamento = pago
      ? payment.paymentDate || payment.confirmedDate || new Date().toLocaleDateString('en-CA')
      : null

    const { data, error } = await db
      .from('pagamentos')
      .update({
        status,
        data_pagamento: dataPagamento,
        valor_pago: pago ? payment.value : null,
        meio_pagamento: payment.billingType ?? null,
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
          forma_pagamento: payment.billingType ?? null,
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
      }
    }

    console.log(`[Asaas Webhook] ${event} ${payment.id} -> ${status}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar webhook Asaas:', error)
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 })
  }
}
