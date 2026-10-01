import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, payment } = body

    // Validar webhook
    if (!event || !payment) {
      return NextResponse.json(
        { error: 'Webhook inválido' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    let status = 'pendente'
    let syncStatus = 'synced'

    // Mapear status do Asaas para o banco
    switch (payment.status) {
      case 'RECEIVED':
        status = 'recebido'
        break
      case 'PENDING':
        status = 'pendente'
        break
      case 'OVERDUE':
        status = 'vencido'
        break
      case 'CANCELLED':
        status = 'cancelado'
        break
    }

    // Atualizar pagamento no banco
    const { error } = await supabase
      .from('pagamentos')
      .update({
        status,
        sync_status: syncStatus,
        data_pagamento: payment.confirmationDate || null,
      })
      .eq('asaas_payment_id', payment.id)

    if (error) {
      console.error('Erro ao atualizar pagamento via webhook:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar pagamento' },
        { status: 500 }
      )
    }

    // Log do webhook
    console.log(`[Asaas Webhook] Pagamento ${payment.id} - Status: ${status}`)

    return NextResponse.json({
      success: true,
      message: 'Webhook processado com sucesso',
    })
  } catch (error) {
    console.error('Erro ao processar webhook Asaas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// Webhook não precisa de autenticação (Asaas chama diretamente)
export const runtime = 'nodejs'
