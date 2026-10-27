import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { criarCobrancaAsaas, CobrancaError } from '@/lib/asaas-cobranca'
import { autorizarAluno } from '@/lib/acesso-aluno'
import { validarValorCobranca } from '@/lib/cobranca-regras'

export async function POST(request: NextRequest) {
  let criadoAgora: string | null = null
  const db = getSupabaseAdmin()

  try {
    const body = await request.json()
    let pagamentoId: string | undefined = body.pagamentoId
    if (!pagamentoId && !body.alunoId) {
      return NextResponse.json({ error: 'pagamentoId ou alunoId obrigatório' }, { status: 400 })
    }

    // De quem é a cobrança? (com pagamentoId, o aluno vem do próprio registro, não do que o navegador mandou)
    let alunoId: string | undefined = body.alunoId
    if (pagamentoId) {
      const { data: pag } = await db.from('pagamentos').select('aluno_id').eq('id', pagamentoId).maybeSingle()
      if (!pag) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
      alunoId = pag.aluno_id
    }

    // Exige login com acesso à unidade do aluno (esta rota usa a chave administrativa, que ignora o controle por unidade)
    const acesso = await autorizarAluno(alunoId)
    if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.status })

    // Sem pagamento existente: cria um registro novo para o aluno
    if (!pagamentoId) {
      // O valor vem da tela, mas nunca pode passar do que o aluno deve
      const erroValor = validarValorCobranca(body.valor, acesso.devido)
      if (erroValor) return NextResponse.json({ error: erroValor }, { status: 400 })
      const valor = Number(body.valor)
      const venc: string = body.dataVencimento || new Date().toLocaleDateString('en-CA')
      // Já existe pagamento deste aluno para este vencimento? Reaproveita em vez de duplicar
      const { data: existente } = await db
        .from('pagamentos')
        .select('id, status')
        .eq('aluno_id', alunoId)
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
          aluno_id: alunoId,
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
