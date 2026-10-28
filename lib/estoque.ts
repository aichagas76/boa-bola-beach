// Regras do estoque (sem banco, para poderem ser testadas).

export type Situacao = 'COMPRAR' | 'ATENÇÃO' | 'OK'
export type Comprador = 'aluno' | 'professor'

export const arredonda = (n: number) => Math.round(n * 100) / 100

/** Saldo = tudo o que entrou menos tudo o que saiu. */
export function saldo(entradas: number[], saidas: number[]) {
  const soma = (l: number[]) => l.reduce((a, b) => a + (Number(b) || 0), 0)
  return soma(entradas) - soma(saidas)
}

/** Alerta do produto: no limite (ou abaixo) é hora de comprar; até 50% acima do limite, atenção. */
export function situacao(saldoAtual: number, limite: number): Situacao {
  if (saldoAtual <= limite) return 'COMPRAR'
  if (saldoAtual <= Math.ceil(limite * 1.5)) return 'ATENÇÃO'
  return 'OK'
}

/** Aluno e professor pagam preços diferentes; se o do professor não foi informado, vale o do aluno. */
export function precoUnitario(p: { preco_aluno: number; preco_professor: number | null }, comprador: Comprador) {
  return comprador === 'professor' && p.preco_professor != null ? p.preco_professor : p.preco_aluno
}

export const totalVenda = (preco: number, qtd: number) => arredonda(preco * qtd)
export const lucroVenda = (preco: number, custo: number, qtd: number) => arredonda((preco - custo) * qtd)

/** Mensagens de erro de uma venda, ou lista vazia. */
export function validarVenda(v: { quantidade: number; saldo: number; comprador: Comprador; aluno_id?: string | null; professor_id?: string | null; preco: number }): string[] {
  const e: string[] = []
  if (!Number.isInteger(v.quantidade) || v.quantidade <= 0) e.push('Informe a quantidade (número inteiro maior que zero).')
  else if (v.quantidade > v.saldo) e.push(`Estoque insuficiente: restam ${v.saldo}.`)
  if (v.comprador === 'aluno' && !v.aluno_id) e.push('Escolha o aluno.')
  if (v.comprador === 'professor' && !v.professor_id) e.push('Escolha o professor.')
  if (!(v.preco >= 0)) e.push('Preço inválido.')
  return e
}

export function validarCompra(c: { quantidade: number; custo_unitario: number }): string[] {
  const e: string[] = []
  if (!Number.isInteger(c.quantidade) || c.quantidade <= 0) e.push('Informe a quantidade (número inteiro maior que zero).')
  if (!(c.custo_unitario >= 0)) e.push('Informe o custo de cada unidade.')
  return e
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const iso = (a: number, m: number, d: number) => `${a}-${doisDigitos(m)}-${doisDigitos(d)}`

/**
 * Quando a venda de um aluno não é paga na hora, ela entra no financeiro para ser paga junto
 * com a mensalidade: vence no próximo dia de vencimento do aluno (hoje, se for hoje).
 * Sem vencimento cadastrado, vence no último dia do mês.
 */
export function vencimentoNaMensalidade(hoje: string, vencimentoCadastro: string | null | undefined): string {
  const [a, m, d] = hoje.split('-').map(Number)
  const ultimoDia = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()
  if (!vencimentoCadastro) return iso(a, m, ultimoDia(a, m))
  const dia = Number(vencimentoCadastro.slice(8, 10))
  const nesteMes = Math.min(dia, ultimoDia(a, m))
  if (nesteMes >= d) return iso(a, m, nesteMes)
  const [a2, m2] = m === 12 ? [a + 1, 1] : [a, m + 1]
  return iso(a2, m2, Math.min(dia, ultimoDia(a2, m2)))
}

/** Venda para professor não paga na hora: vence no último dia do mês. */
export function vencimentoProfessor(hoje: string): string {
  const [a, m] = hoje.split('-').map(Number)
  return iso(a, m, new Date(a, m, 0).getDate())
}

/** Lucro de uma lista de vendas (preço menos custo vezes quantidade). */
export function lucroTotal(vendas: { preco_unitario: number; custo_unitario: number; quantidade: number }[]) {
  return arredonda(vendas.reduce((a, v) => a + (v.preco_unitario - v.custo_unitario) * v.quantidade, 0))
}

/** Comissão de indicação: porcentagem do valor da venda (arredondada em centavos). */
export const comissaoIndicacao = (totalVenda: number, percentual: number) => arredonda((totalVenda * percentual) / 100)

/** Encordoamento: comissão da indicação e valor por unidade começam em 10% e R$ 10,00 quando o produto não tem outro valor cadastrado. */
export const PADRAO_ENCORDOAMENTO = { indicacaoPct: 10, valorPorUnidade: 10 }
export function padroesEncordoamento(p: { encordoamento: boolean; comissao_indicacao?: number | null; comissao_valor?: number | null }) {
  if (!p.encordoamento) return null
  return {
    indicacaoPct: Number(p.comissao_indicacao) > 0 ? Number(p.comissao_indicacao) : PADRAO_ENCORDOAMENTO.indicacaoPct,
    valorPorUnidade: Number(p.comissao_valor) > 0 ? Number(p.comissao_valor) : PADRAO_ENCORDOAMENTO.valorPorUnidade,
  }
}
