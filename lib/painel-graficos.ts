// Séries mensais dos gráficos de vendas de produtos e de inativações/reativações (sem banco, para poder ser testado).
// Datas sempre 'AAAA-MM-DD'; meses 'AAAA-MM'.
import { deslocarMes, mesDe, rotuloMes } from './painel.ts'

export type Janela = { inicio: string; fim: string }

/** Últimos N meses, contando o mês atual (1 = só o mês atual), até hoje. */
export function janelaDeMeses(n: number, hoje: string): Janela {
  return { inicio: `${deslocarMes(mesDe(hoje), -(Math.max(n, 1) - 1))}-01`, fim: hoje }
}

/** Todos os meses entre duas datas, inclusive os vazios. */
export function mesesEntre(inicio: string, fim: string): string[] {
  const lista: string[] = []
  if (inicio > fim) return lista
  for (let m = mesDe(inicio); m <= mesDe(fim); m = deslocarMes(m, 1)) lista.push(m)
  return lista
}

export type Evento = { data: string; valor?: number; grupo?: string }
export type PontoMensal = { mes: string; rotulo: string; total: number; qtd: number } & Record<string, number | string>

const centavos = (n: number) => Math.round(n * 100)

/** Soma por mês dos eventos dentro da janela. `grupos` separa a soma em colunas (ex.: registrado e estimado). */
export function serieMensal(eventos: Evento[], janela: Janela, grupos: string[] = []): PontoMensal[] {
  const pontos = mesesEntre(janela.inicio, janela.fim).map(mes => {
    const p: PontoMensal = { mes, rotulo: rotuloMes(mes), total: 0, qtd: 0 }
    for (const g of grupos) p[g] = 0
    return p
  })
  const porMes = new Map(pontos.map(p => [p.mes, p]))
  const soma = new Map<string, number>()
  for (const e of eventos) {
    if (e.data < janela.inicio || e.data > janela.fim) continue
    const p = porMes.get(mesDe(e.data))
    if (!p) continue
    const v = e.valor ?? 1
    const chave = (g: string) => `${p.mes}|${g}`
    soma.set(chave('total'), (soma.get(chave('total')) ?? 0) + centavos(v))
    p.qtd += 1
    if (e.grupo && grupos.includes(e.grupo)) soma.set(chave(e.grupo), (soma.get(chave(e.grupo)) ?? 0) + centavos(v))
  }
  for (const p of pontos) {
    p.total = (soma.get(`${p.mes}|total`) ?? 0) / 100
    for (const g of grupos) p[g] = (soma.get(`${p.mes}|${g}`) ?? 0) / 100
  }
  return pontos
}

export type DespesaCat = { name: string; value: number; pct: number }

/** Despesas pagas no período, somadas por categoria (maiores primeiro; o que passar de `maximo` fatias vai para "Outras"). `excluir` tira categorias do cálculo. */
export function despesasPorCategoria(
  movs: { tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; categoria: string | null }[],
  janela: Janela,
  maximo = 8,
  excluir: string[] = [],
): DespesaCat[] {
  const por = new Map<string, number>()
  for (const m of movs) {
    if (m.tipo !== 'Saída' || m.status !== 'Pago') continue
    const d = m.data_pagamento ?? m.data
    if (d < janela.inicio || d > janela.fim) continue
    const nome = m.categoria?.trim() || 'Sem categoria'
    if (excluir.includes(nome)) continue
    por.set(nome, (por.get(nome) ?? 0) + centavos(Number(m.valor)))
  }
  const ordenado = [...por.entries()].sort((a, b) => b[1] - a[1])
  const topo = ordenado.slice(0, maximo)
  const resto = ordenado.slice(maximo).reduce((s, [, v]) => s + v, 0)
  if (resto > 0) topo.push(['Outras', resto])
  const total = topo.reduce((s, [, v]) => s + v, 0)
  return topo.map(([name, v]) => ({ name, value: v / 100, pct: total ? (v / total) * 100 : 0 }))
}

export type MovProfessorGrafico = {
  tipo: string
  status: string | null
  valor: number
  data: string
  data_pagamento: string | null
  professor_id: string | null
  professor_nome: string | null
  esporte_nome: string | null
  aluno_ref_id: string | null
}
export type FaturamentoProfessor = { id: string; professor: string; total: number; qtd: number; porEsporte: Record<string, number> }
export type PontoProfessorMes = { mes: string; rotulo: string; total: number; alunos: number }

/**
 * Faturamento dos professores no período: entradas recebidas (pela data do pagamento) ligadas a um professor.
 *  - `ranking`: total de cada professor, do maior para o menor, com o detalhe por esporte;
 *  - `porMes`: valor recebido por mês e quantos alunos diferentes pagaram, só do professor escolhido (ou de todos).
 */
export function faturamentoProfessores(movs: MovProfessorGrafico[], janela: Janela, professorId = '') {
  const doPeriodo = movs.filter(m => {
    if (m.tipo !== 'Entrada' || m.status !== 'Recebido' || !m.professor_id) return false
    const d = m.data_pagamento ?? m.data
    return d >= janela.inicio && d <= janela.fim
  })

  const por = new Map<string, { id: string; professor: string; centavos: number; qtd: number; esportes: Map<string, number> }>()
  for (const m of doPeriodo) {
    const l = por.get(m.professor_id!) ?? { id: m.professor_id!, professor: m.professor_nome ?? 'Professor sem nome', centavos: 0, qtd: 0, esportes: new Map<string, number>() }
    const c = centavos(Number(m.valor))
    l.centavos += c
    l.qtd += 1
    const e = m.esporte_nome ?? 'Sem esporte'
    l.esportes.set(e, (l.esportes.get(e) ?? 0) + c)
    por.set(m.professor_id!, l)
  }
  const ranking: FaturamentoProfessor[] = [...por.values()]
    .sort((a, b) => b.centavos - a.centavos || a.professor.localeCompare(b.professor, 'pt-BR'))
    .map(l => ({ id: l.id, professor: l.professor, total: l.centavos / 100, qtd: l.qtd, porEsporte: Object.fromEntries([...l.esportes].map(([e, v]) => [e, v / 100])) }))

  const escolhidos = professorId ? doPeriodo.filter(m => m.professor_id === professorId) : doPeriodo
  const meses = mesesEntre(janela.inicio, janela.fim)
  const totalMes = new Map<string, number>()
  const alunosMes = new Map<string, Set<string>>()
  for (const m of escolhidos) {
    const mes = mesDe(m.data_pagamento ?? m.data)
    totalMes.set(mes, (totalMes.get(mes) ?? 0) + centavos(Number(m.valor)))
    if (m.aluno_ref_id) { const s = alunosMes.get(mes) ?? new Set<string>(); s.add(m.aluno_ref_id); alunosMes.set(mes, s) }
  }
  const porMes: PontoProfessorMes[] = meses.map(mes => ({ mes, rotulo: rotuloMes(mes), total: (totalMes.get(mes) ?? 0) / 100, alunos: alunosMes.get(mes)?.size ?? 0 }))
  return { ranking, porMes }
}
