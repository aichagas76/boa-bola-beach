import type { SupabaseClient } from '@supabase/supabase-js'
import { getAsaasClient } from '@/lib/asaas-client'

export class CobrancaError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

/**
 * Cria (ou reaproveita) a cobrança Asaas de um registro da tabela pagamentos.
 * Cria o cliente no Asaas se o aluno ainda não tiver asaas_customer_id.
 */
export async function criarCobrancaAsaas(db: SupabaseClient, pagamentoId: string) {
  const { data: pag } = await db
    .from('pagamentos')
    .select('id, aluno_id, valor, data_vencimento, competencia, link_pagamento, id_cobranca_asaas')
    .eq('id', pagamentoId)
    .single()
  if (!pag) throw new CobrancaError('Pagamento não encontrado', 404)

  if (pag.link_pagamento) {
    return { paymentId: pag.id_cobranca_asaas as string | null, paymentUrl: pag.link_pagamento as string }
  }
  if (!pag.valor || !pag.data_vencimento) {
    throw new CobrancaError('Pagamento sem valor ou vencimento', 400)
  }

  const { data: aluno } = await db
    .from('alunos')
    .select('id, nome, celular, cpf, asaas_customer_id')
    .eq('id', pag.aluno_id)
    .single()
  if (!aluno) throw new CobrancaError('Aluno não encontrado', 404)

  const asaas = getAsaasClient()

  let customerId = aluno.asaas_customer_id as string | null
  if (!customerId) {
    if (!aluno.cpf) throw new CobrancaError('Aluno sem CPF cadastrado', 400)
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

  const { error } = await db
    .from('pagamentos')
    .update({ id_cobranca_asaas: payment.id, link_pagamento: payment.invoiceUrl })
    .eq('id', pag.id)
  if (error) console.error('Erro ao salvar cobrança:', error)

  return { paymentId: payment.id, paymentUrl: payment.invoiceUrl }
}
