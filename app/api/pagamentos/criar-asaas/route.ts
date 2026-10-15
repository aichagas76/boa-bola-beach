import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAsaasClient } from '@/lib/asaas-client'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { pagamentoId } = await request.json()
    if (!pagamentoId) {
      return NextResponse.json({ error: 'pagamentoId obrigatório' }, { status: 400 })
    }

    // Exige usuário logado
    const cookieStore = await cookies()
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const db = getSupabaseAdmin()

    const { data: pag } = await db
      .from('pagamentos')
      .select('id, aluno_id, valor, data_vencimento, competencia, link_pagamento, id_cobranca_asaas')
      .eq('id', pagamentoId)
      .single()
    if (!pag) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

    if (pag.link_pagamento) {
      return NextResponse.json({ success: true, paymentUrl: pag.link_pagamento, paymentId: pag.id_cobranca_asaas })
    }
    if (!pag.valor || !pag.data_vencimento) {
      return NextResponse.json({ error: 'Pagamento sem valor ou vencimento' }, { status: 400 })
    }

    const { data: aluno } = await db
      .from('alunos')
      .select('id, nome, celular, cpf, asaas_customer_id')
      .eq('id', pag.aluno_id)
      .single()
    if (!aluno) return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })

    const asaas = getAsaasClient()

    let customerId = aluno.asaas_customer_id as string | null
    if (!customerId) {
      if (!aluno.cpf) {
        return NextResponse.json({ error: 'Aluno sem CPF cadastrado' }, { status: 400 })
      }
      const customer = (await asaas.createCustomer({
        name: aluno.nome,
        phone: aluno.celular ?? undefined,
        cpf: aluno.cpf,
      })) as { id: string }
      customerId = customer.id
      await db.from('alunos').update({ asaas_customer_id: customerId }).eq('id', aluno.id)
    }

    const payment = await asaas.createPayment({
      customerId,
      value: Number(pag.valor),
      dueDate: pag.data_vencimento,
      description: `Boa Bola - ${aluno.nome}${pag.competencia ? ` (${pag.competencia})` : ''}`,
      reference: pag.id,
    })

    const { error: updateError } = await db
      .from('pagamentos')
      .update({
        id_cobranca_asaas: payment.id,
        link_pagamento: payment.invoiceUrl,
      })
      .eq('id', pag.id)
    if (updateError) console.error('Erro ao salvar cobrança:', updateError)

    return NextResponse.json({ success: true, paymentId: payment.id, paymentUrl: payment.invoiceUrl })
  } catch (error) {
    console.error('Erro ao criar cobrança Asaas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
