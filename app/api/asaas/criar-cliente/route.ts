import { NextRequest, NextResponse } from 'next/server'
import { getAsaasClient } from '@/lib/asaas-client'
import { autorizarAluno } from '@/lib/acesso-aluno'
import { asaasLigado } from '@/lib/cobranca-regras'

export async function POST(request: NextRequest) {
  // Desligado por padrão (só liga com ASAAS_ATIVO=sim). Responde sem erro para o cadastro de aluno seguir normal, sem criar nada no Asaas.
  if (!asaasLigado(process.env.ASAAS_ATIVO)) return NextResponse.json({ desligado: true })
  try {
    const { nome, celular, cpf, aluno_id } = await request.json()

    // Só quem está logado e tem acesso à unidade do aluno cria o cliente dele no Asaas
    const acesso = await autorizarAluno(aluno_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.status })

    if (!nome || !cpf) {
      return NextResponse.json(
        { error: 'Nome e CPF são obrigatórios' },
        { status: 400 }
      )
    }

    const asaas = getAsaasClient()

    const customer = await asaas.createCustomer({
      name: nome,
      phone: celular,
      cpf,
    })

    return NextResponse.json({
      id: (customer as { id: string }).id,
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
