import { NextRequest, NextResponse } from 'next/server'
import { getAsaasClient } from '@/lib/asaas-client'

export async function POST(request: NextRequest) {
  try {
    const { nome, celular, cpf, aluno_id } = await request.json()

    if (!nome || !cpf) {
      return NextResponse.json(
        { error: 'Nome e CPF são obrigatórios' },
        { status: 400 }
      )
    }

    const asaas = getAsaasClient()

    const customer = await asaas.createCustomer({
      name: nome,
      email: `${aluno_id}@boabola.com`,
      phone: celular,
      cpf,
    })

    return NextResponse.json({
      id: (customer as any).id,
      success: true,
    })
  } catch (error) {
    console.error('Erro ao criar cliente Asaas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar cliente' },
      { status: 500 }
    )
  }
}
