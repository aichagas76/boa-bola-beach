// Fluxo de caixa do Painel (sem banco, para poder ser testado). Só o REALIZADO: o dinheiro que de fato entrou e saiu.
//  - Entrada conta quando está 'Recebido'; saída conta quando está 'Pago'. Em aberto, cancelado e estornado ficam de fora.
//  - A data é a do pagamento (ou a do lançamento, se não houver), como no resto do Painel.
//  - Saldo do período = entradas - saídas. "Acumulado" é a soma dos saldos desde o começo do período (não é o saldo do banco:
//    o sistema ainda não sabe quanto havia em cada conta no começo).
// Datas sempre 'AAAA-MM-DD'.

export type MovFluxo = {
  tipo: string
  status: string | null
  valor: number
  data: string
  data_pagamento: string | null
  conta_id?: string | null
}
export type Granularidade = 'dia' | 'semana' | 'mes'
export type PontoFluxo = {
  chave: string
  rotulo: string
  inicio: string
  fim: string
  entradas: number
  saidas: number
  saldo: number
  acumulado: number
}
export type ResumoFluxo = {
  pontos: PontoFluxo[]
  entradas: number
  saidas: number
  saldo: number
  semConta: { qtd: number; entradas: number; saidas: number }
  maiorSaida: PontoFluxo | null
  menorSaldo: PontoFluxo | null
}

/** Filtro especial: só lançamentos sem conta informada. */
export const SEM_CONTA = '__sem_conta__'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dois = (n: number) => String(n).padStart(2, '0')
const paraData = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const paraIso = (d: Date) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
const somarDias = (s: string, n: number) => paraIso(new Date(paraData(s).getTime() + n * 86400000))
const diasEntre = (de: string, ate: string) => Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86400000)
const centavos = (n: number) => Math.round(n * 100)
const reais = (c: number) => c / 100
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

/** Segunda-feira da semana da data. */
const segunda = (s: string) => somarDias(s, -((paraData(s).getUTCDay() + 6) % 7))

/** Escolha automática: período curto por dia, médio por semana, longo por mês. */
export function granularidadeAuto(inicio: string, fim: string): Granularidade {
  const dias = diasEntre(inicio, fim) + 1
  return dias <= 35 ? 'dia' : dias <= 130 ? 'semana' : 'mes'
}

/** Esta movimentação já aconteceu de fato (dinheiro que entrou ou saiu)? */
export const foiRealizado = (m: MovFluxo) => (m.tipo === 'Entrada' && m.status === 'Recebido') || (m.tipo === 'Saída' && m.status === 'Pago')

export const dataDoCaixa = (m: MovFluxo) => m.data_pagamento ?? m.data

/** Faixas (baldes) do período, já cortadas nas pontas do período. */
function faixas(inicio: string, fim: string, g: Granularidade): { chave: string; rotulo: string; inicio: string; fim: string }[] {
  const lista: { chave: string; rotulo: string; inicio: string; fim: string }[] = []
  if (inicio > fim) return lista
  if (g === 'dia') {
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) lista.push({ chave: d, rotulo: ddmm(d), inicio: d, fim: d })
  } else if (g === 'semana') {
    for (let s = segunda(inicio); s <= fim; s = somarDias(s, 7)) {
      const i = s < inicio ? inicio : s
      const f = somarDias(s, 6) > fim ? fim : somarDias(s, 6)
      lista.push({ chave: s, rotulo: i === f ? ddmm(i) : `${ddmm(i)}–${ddmm(f)}`, inicio: i, fim: f })
    }
  } else {
    let [y, m] = inicio.split('-').map(Number)
    const [yf, mf] = fim.split('-').map(Number)
    while (y < yf || (y === yf && m <= mf)) {
      const ini = `${y}-${dois(m)}-01`
      const f = `${y}-${dois(m)}-${dois(ultimoDiaDoMes(y, m))}`
      lista.push({ chave: `${y}-${dois(m)}`, rotulo: `${MESES[m - 1]}/${String(y).slice(2)}`, inicio: ini < inicio ? inicio : ini, fim: f > fim ? fim : f })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  return lista
}

export function fluxoDeCaixa(movs: MovFluxo[], opc: { inicio: string; fim: string; granularidade: Granularidade; conta?: string }): ResumoFluxo {
  const { inicio, fim, granularidade, conta } = opc
  const doPeriodo = movs.filter(m => {
    if (!foiRealizado(m)) return false
    const d = dataDoCaixa(m)
    if (d < inicio || d > fim) return false
    if (!conta) return true
    return conta === SEM_CONTA ? !m.conta_id : m.conta_id === conta
  })

  const baldes = faixas(inicio, fim, granularidade).map(f => ({ ...f, ent: 0, sai: 0 }))
  const achar = (d: string) => baldes.find(b => d >= b.inicio && d <= b.fim)
  const semConta = { qtd: 0, ent: 0, sai: 0 }
  for (const m of doPeriodo) {
    const b = achar(dataDoCaixa(m))
    if (!b) continue
    const c = centavos(Number(m.valor))
    if (m.tipo === 'Entrada') b.ent += c
    else b.sai += c
    if (!m.conta_id) { semConta.qtd++; if (m.tipo === 'Entrada') semConta.ent += c; else semConta.sai += c }
  }

  let acum = 0
  const pontos: PontoFluxo[] = baldes.map(b => {
    const saldo = b.ent - b.sai
    acum += saldo
    return { chave: b.chave, rotulo: b.rotulo, inicio: b.inicio, fim: b.fim, entradas: reais(b.ent), saidas: reais(b.sai), saldo: reais(saldo), acumulado: reais(acum) }
  })
  const entradas = reais(baldes.reduce((a, b) => a + b.ent, 0))
  const saidas = reais(baldes.reduce((a, b) => a + b.sai, 0))
  const comMovimento = pontos.filter(p => p.entradas > 0 || p.saidas > 0)
  return {
    pontos,
    entradas,
    saidas,
    saldo: reais(centavos(entradas) - centavos(saidas)),
    semConta: { qtd: semConta.qtd, entradas: reais(semConta.ent), saidas: reais(semConta.sai) },
    maiorSaida: comMovimento.reduce<PontoFluxo | null>((a, p) => (p.saidas > 0 && (!a || p.saidas > a.saidas) ? p : a), null),
    menorSaldo: comMovimento.reduce<PontoFluxo | null>((a, p) => (!a || p.saldo < a.saldo ? p : a), null),
  }
}
