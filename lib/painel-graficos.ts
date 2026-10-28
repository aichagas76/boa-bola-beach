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
