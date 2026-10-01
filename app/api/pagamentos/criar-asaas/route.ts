import { NextRequest, NextResponse } from 'next/server'
import { getAsaasClient } from '@/lib/asaas-client'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { alunoId, valor, dataVencimento, descricao } = body

    if (!alunoId || !valor || !dataVencimento) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios ausentes' },
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

    // Buscar dados do aluno
    const { data: aluno, error: alunoError } = await supabase
      .from('alunos')
      .select('id, nome, email, telefone, cpf')
      .eq('id', alunoId)
      .single()

    if (alunoError || !aluno) {
      return NextResponse.json(
        { error: 'Aluno não encontrado' },
        { status: 404 }
      )
    }

    const asaas = getAsaasClient()

    // Verificar ou criar cliente no Asaas
    let customerId: string
    const { data: existingCustomer } = await supabase
      .from('asaas_customers')
      .select('asaas_id')
      .eq('cpf', aluno.cpf)
      .single()

    if (existingCustomer?.asaas_id) {
      customerId = existingCustomer.asaas_id
    } else {
      try {
        const customer = (await asaas.createCustomer({
          name: aluno.nome,
          email: aluno.email || 'nao-informado@boabola.com',
          phone: aluno.telefone,
          cpf: aluno.cpf,
        })) as { id: string }

        customerId = customer.id

        // Salvar cliente no banco
        await supabase.from('asaas_customers').insert({
          asaas_id: customer.id,
          name: aluno.nome,
          email: aluno.email,
          phone: aluno.telefone,
          cpf: aluno.cpf,
        })
      } catch (error) {
        console.error('Erro ao criar cliente Asaas:', error)
        return NextResponse.json(
          { error: 'Erro ao criar cliente no Asaas' },
          { status: 500 }
        )
      }
    }

    // Criar cobrança
    const payment = await asaas.createPayment({
      customerId,
      value: valor,
      dueDate: dataVencimento,
      description: descricao || `Cobrança - ${aluno.nome}`,
      reference: `BOABOLA-${alunoId}`,
    })

    // Atualizar pagamento no banco com dados do Asaas
    const { error: updateError } = await supabase
      .from('pagamentos')
      .update({
        asaas_payment_id: payment.id,
        asaas_customer_id: customerId,
        asaas_payment_url: payment.paymentUrl,
        payment_type: 'asaas',
        sync_status: 'synced',
      })
      .eq('id', body.pagamentoId)

    if (updateError) {
      console.error('Erro ao atualizar pagamento:', updateError)
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: payment.paymentUrl,
      customer: {
        id: customerId,
        name: aluno.nome,
      },
    })
  } catch (error) {
    console.error('Erro ao criar cobrança Asaas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
