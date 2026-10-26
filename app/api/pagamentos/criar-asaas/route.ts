import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { criarCobrancaAsaas, CobrancaError } from '@/lib/asaas-cobranca'

export async function POST(request: NextRequest) {
  let criadoAgora: string | null = null
  const db = getSupabaseAdmin()

  try {
    const body = await request.json()
    let pagamentoId: string | undefined = body.pagamentoId
    if (!pagamentoId && !body.alunoId) {
      return NextResponse.json({ error: 'pagamentoId ou alunoId obrigatório' }, { status: 400 })
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

    // Sem pagamento existente: cria um registro novo para o aluno
    if (!pagamentoId) {
      const valor = Number(body.valor)
      if (!valor || valor <= 0) {
        return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      }
      const venc: string = body.dataVencimento || new Date().toLocaleDateString('en-CA')
      // Já existe pagamento deste aluno para este vencimento? Reaproveita em vez de duplicar
      const { data: existente } = await db
        .from('pagamentos')
        .select('id, status')
        .eq('aluno_id', body.alunoId)
        .eq('data_vencimento', venc)
        .order('created_at', { ascending: false })
      if (existente && existente.length > 0) {
        if (existente.every(e => e.status === 'Pago')) {
          return NextResponse.json({ error: 'Este vencimento já está pago' }, { status: 409 })
        }
        const aberto = existente.find(e => e.status !== 'Pago')!
        const { paymentId, paymentUrl } = await criarCobrancaAsaas(db, aberto.id)
        return NextResponse.json({ success: true, paymentId, paymentUrl, reaproveitado: true })
      }
      const { data: novo, error: novoError } = await db
        .from('pagamentos')
        .insert({
          aluno_id: body.alunoId,
          valor,
          data_vencimento: venc,
          competencia: venc.slice(0, 7),
          status: 'Pendente',
        })
        .select('id')
        .single()
      if (novoError || !novo) {
        console.error('Erro ao criar pagamento:', novoError)
        return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
      }
      pagamentoId = novo.id
      criadoAgora = novo.id
    }

    const { paymentId, paymentUrl } = await criarCobrancaAsaas(db, pagamentoId!)
    return NextResponse.json({ success: true, paymentId, paymentUrl })
  } catch (error) {
    // Não deixa registro vazio quando a cobrança falhou
    if (criadoAgora) await db.from('pagamentos').delete().eq('id', criadoAgora)

    console.error('Erro ao criar cobrança Asaas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: error instanceof CobrancaError ? error.status : 500 }
    )
  }
}
