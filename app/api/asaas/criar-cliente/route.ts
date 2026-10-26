import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAsaasClient } from '@/lib/asaas-client'

export async function POST(request: NextRequest) {
  try {
    // Só quem está logado cria cliente no Asaas (o menu deixa esta rota fora da checagem de login)
    const cookieStore = await cookies()
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

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
