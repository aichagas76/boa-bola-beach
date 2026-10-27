// Regras puras da importação da planilha do AppSheet (BB 1.0) para o sistema novo. Sem banco, para poderem ser testadas.
import { createHash } from 'node:crypto'

/** Texto sem acento, minúsculo e com espaços simples — para comparar nomes. */
export const normaliza = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const soDigitos = (s: string) => (s ?? '').replace(/\D/g, '')

const dois = (n: number | string) => String(n).padStart(2, '0')

/** '26/07/2026' ou '05/08/2026 15:53:20' -> '2026-07-26'. Inválida -> null. */
export function parseDataBR(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec((s ?? '').trim())
  if (!m) return null
  const [d, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null
  return `${ano}-${dois(mes)}-${dois(d)}`
}

/** 'R$ 1.234,56' / '8,00' / '120' -> número. Vazio ou inválido -> null. */
export function parseValorBR(s: string): number | null {
  const t = (s ?? '').replace(/R\$/g, '').replace(/\s/g, '')
  if (!t) return null
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : null
}

/** Comissão do professor: '0,5' -> 50, '35,00%' -> 35, '100%' -> 100, '0,35' -> 35. */
export function parseComissao(s: string): number {
  const t = (s ?? '').trim()
  if (!t) return 0
  const n = parseValorBR(t.replace('%', ''))
  if (n === null) return 0
  return t.includes('%') ? n : n <= 1 ? Math.round(n * 10000) / 100 : n
}

/** Celular no formato do sistema: (19) 98222-0600. Menos de 10 dígitos -> null. */
export function formataCelular(s: string): string | null {
  let d = soDigitos(s)
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return null
}

/** CPF com 11 dígitos -> 000.000.000-00; qualquer outra coisa -> null. */
export function formataCpf(s: string): string | null {
  const d = soDigitos(s)
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : null
}

const ESPORTES: Record<string, string> = { 'beach tenis': 'Beach Tênis', 'beach tennis': 'Beach Tênis', tenis: 'Tênis', tennis: 'Tênis', pickleball: 'Pickleball', padel: 'Padel' }
/** Nome do esporte como o sistema usa; 'GERAL', 'Rateio' e vazio -> null (lançamento sem esporte). */
export const esporteDe = (s: string): string | null => ESPORTES[normaliza(s)] ?? null

/** Forma de pagamento como o sistema usa. */
export function formaDe(s: string): string {
  const n = normaliza(s)
  if (n === 'pix asaas') return 'PIX Asaas'
  if (n === 'pix') return 'Pix'
  if (n === 'dinheiro') return 'Dinheiro'
  if (n === 'boleto') return 'Boleto'
  if (n.includes('debito')) return 'Cartão Débito'
  if (n.includes('credito') || n === 'cartao') return 'Cartão Crédito'
  return 'Pix'
}

export const tipoMovDe = (s: string): 'Entrada' | 'Saída' | null => {
  const n = normaliza(s)
  return n === 'entrada' ? 'Entrada' : n === 'saida' ? 'Saída' : null
}

export const modalidadeDe = (s: string): 'Clubinho' | 'Aula' | 'Ranking' | null => {
  const n = normaliza(s)
  return n === 'clubinho' ? 'Clubinho' : n === 'aula' ? 'Aula' : n === 'ranking' ? 'Ranking' : null
}

/** UUID v5 (determinístico): o mesmo registro antigo gera sempre o mesmo id, então a importação pode ser repetida sem duplicar. */
export function uuidV5(nome: string, namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const h = createHash('sha1').update(ns).update(nome, 'utf8').digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

export type SituacaoMov = { status: 'Recebido' | 'Pago' | 'Não recebido' | 'Pendente'; dataPagamento: string | null; correcao?: string }

/**
 * Situação do lançamento, já coerente com as regras do banco (pago exige data de pagamento; em aberto não pode ter).
 * Quando a planilha se contradiz, vale a data de pagamento: se existe, foi pago.
 */
export function situacaoMov(tipo: 'Entrada' | 'Saída', pagoTxt: string, dataPagamento: string | null, vencimento: string | null): SituacaoMov {
  const pagoNome = tipo === 'Entrada' ? 'Recebido' : 'Pago'
  const abertoNome = tipo === 'Entrada' ? 'Não recebido' : 'Pendente'
  const n = normaliza(pagoTxt)
  const dizPago = n === 'pago' || n === 'recebido'
  const dizAberto = n === 'pendente' || n === 'nao recebido'
  if (dizPago) {
    if (dataPagamento) return { status: pagoNome, dataPagamento }
    return { status: pagoNome, dataPagamento: vencimento, correcao: 'pago sem data de pagamento: usado o vencimento' }
  }
  if (dizAberto) {
    if (dataPagamento) return { status: pagoNome, dataPagamento, correcao: 'marcado em aberto mas com data de pagamento: tratado como pago' }
    return { status: abertoNome, dataPagamento: null }
  }
  // vazio ou desconhecido: a data de pagamento decide
  if (dataPagamento) return { status: pagoNome, dataPagamento, correcao: 'situação em branco: tratado como pago pela data de pagamento' }
  return { status: abertoNome, dataPagamento: null, correcao: 'situação em branco: tratado como em aberto' }
}
