// Ordenação por coluna das listas (sem banco, para poderem ser testadas).
// Regras: texto sem diferenciar maiúsculas/acentos, números como números, datas como datas;
// o que está vazio vai sempre para o fim, tanto na ordem crescente quanto na decrescente.

export type Direcao = 'asc' | 'desc'
export type Valor = string | number | null | undefined

const texto = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const vazio = (v: Valor) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))

export function comparar(a: Valor, b: Valor, direcao: Direcao) {
  const va = vazio(a)
  const vb = vazio(b)
  if (va && vb) return 0
  if (va) return 1 // vazio sempre no fim
  if (vb) return -1
  const sinal = direcao === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return sinal * (a - b)
  return sinal * texto(String(a)).localeCompare(texto(String(b)), 'pt-BR', { numeric: true })
}

/** Ordena uma cópia da lista pela chave escolhida; empates mantêm a ordem original. */
export function ordenar<T>(lista: T[], chave: (item: T) => Valor, direcao: Direcao): T[] {
  return lista
    .map((item, i) => ({ item, i }))
    .sort((x, y) => comparar(chave(x.item), chave(y.item), direcao) || x.i - y.i)
    .map(x => x.item)
}

/** Clique no título: a mesma coluna alterna crescente/decrescente; outra coluna começa crescente. */
export function proximaOrdem<C extends string>(atual: { coluna: C; direcao: Direcao }, clicada: C): { coluna: C; direcao: Direcao } {
  return { coluna: clicada, direcao: atual.coluna === clicada && atual.direcao === 'asc' ? 'desc' : 'asc' }
}
