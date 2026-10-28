// Tela "Pagamentos Aluno" (sem banco, para poder ser testada): histórico do que cada aluno pagou ou deve,
// por período e por tipo (mensalidade de aula/clubinho/etc. ou venda de produto). Datas 'AAAA-MM-DD'.

export type TipoPeriodo = 'dia' | '7dias' | 'mes' | 'semestre' | 'ano' | 'data' | 'tudo'

export type EntradaAluno = {
  id: string
  aluno_ref_id: string | null
  status: string | null
  valor: number
  data: string
  data_vencimento: string | null
  data_pagamento: string | null
  categoria: string | null
}

const dois = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const ultimoDiaDoMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const centavos = (n: number) => Math.round(n * 100)

export const normaliza = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Intervalo de cada período. "Do mês", "do semestre" e "do ano" são os de calendário (vão até o fim, para pegar o que vence
 * mais adiante no mesmo mês); "dia" e "7 dias" terminam hoje; "data" usa as duas datas escolhidas; "tudo" não limita.
 */
export function intervaloDoPeriodo(tipo: TipoPeriodo, hoje: string, de = '', ate = ''): { inicio: string; fim: string } {
  const d = parse(hoje)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  switch (tipo) {
    case 'dia': return { inicio: hoje, fim: hoje }
    case '7dias': return { inicio: iso(new Date(d.getTime() - 6 * 86400000)), fim: hoje }
    case 'mes': return { inicio: `${y}-${dois(m)}-01`, fim: `${y}-${dois(m)}-${dois(ultimoDiaDoMes(y, m))}` }
    case 'semestre': return m <= 6 ? { inicio: `${y}-01-01`, fim: `${y}-06-30` } : { inicio: `${y}-07-01`, fim: `${y}-12-31` }
    case 'ano': return { inicio: `${y}-01-01`, fim: `${y}-12-31` }
    case 'data': return { inicio: de || hoje, fim: ate || de || hoje }
    default: return { inicio: '0000-01-01', fim: '9999-12-31' }
  }
}

/** Venda de produto ou mensalidade (aula, clubinho, ranking...). */
export const tipoDaEntrada = (categoria: string | null): 'produto' | 'mensalidade' => (normaliza(categoria).includes('produto') ? 'produto' : 'mensalidade')

export const foiRecebida = (e: { status: string | null }) => e.status === 'Recebido'
const cancelada = (e: { status: string | null }) => e.status === 'Cancelado' || e.status === 'Estornado'

/** O dia que vale para o período: o do pagamento, se já foi pago; senão o do vencimento. */
export const dataDaEntrada = (e: EntradaAluno) => (foiRecebida(e) ? (e.data_pagamento ?? e.data) : (e.data_vencimento ?? e.data))

export type FiltroPagamentos = {
  periodo: { inicio: string; fim: string }
  tipo: 'todos' | 'mensalidade' | 'produto'
  /** Dentro de mensalidade: só uma categoria (ex.: "Clubinho"); vazio = todas */
  categoria: string
  alunoId: string
}

/** Mês de competência no formato 10/26. */
export const competenciaCurta = (data: string | null) => (data ? `${data.slice(5, 7)}/${data.slice(2, 4)}` : '-')

/** Entradas de alunos no período e nos filtros, da mais recente para a mais antiga. */
export function filtrarPagamentos(entradas: EntradaAluno[], f: FiltroPagamentos): EntradaAluno[] {
  return entradas
    .filter(e => {
      if (cancelada(e)) return false
      // Venda de produto sem aluno (balcão ou professor) também aparece, mas só quando não se escolheu um aluno
      if (!e.aluno_ref_id && (f.alunoId || tipoDaEntrada(e.categoria) !== 'produto')) return false
      const d = dataDaEntrada(e)
      if (d < f.periodo.inicio || d > f.periodo.fim) return false
      if (f.alunoId && e.aluno_ref_id !== f.alunoId) return false
      const t = tipoDaEntrada(e.categoria)
      if (f.tipo !== 'todos' && t !== f.tipo) return false
      if (f.tipo === 'mensalidade' && f.categoria && (e.categoria ?? '') !== f.categoria) return false
      return true
    })
    .sort((a, b) => dataDaEntrada(b).localeCompare(dataDaEntrada(a)) || b.id.localeCompare(a.id))
}

/** Pago, pendente e último pagamento da lista (já filtrada). */
export function resumoPagamentos(lista: EntradaAluno[]) {
  const soma = (xs: EntradaAluno[]) => xs.reduce((s, e) => s + centavos(Number(e.valor)), 0) / 100
  const pagos = lista.filter(foiRecebida)
  const ultimo = pagos.map(e => e.data_pagamento ?? e.data).sort().at(-1) ?? null
  return { pago: soma(pagos), pendente: soma(lista.filter(e => !foiRecebida(e))), qtdPagos: pagos.length, qtdPendentes: lista.length - pagos.length, ultimoPagamento: ultimo }
}

/** Categorias de mensalidade que existem nos dados (para os botões de Clubinho, Aula Tênis etc.). */
export function categoriasDeMensalidade(entradas: EntradaAluno[]): string[] {
  const set = new Set<string>()
  for (const e of entradas) if (e.categoria && tipoDaEntrada(e.categoria) === 'mensalidade') set.add(e.categoria)
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
