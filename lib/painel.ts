// Contas do Painel gerencial (sem banco, para poderem ser testadas).
// Todas as datas são 'AAAA-MM-DD'. Definições usadas em todo o painel:
//  - Aluno ativo: alunos.status = 'Ativo'.
//  - Receita recebida: entradas do financeiro com status 'Recebido', no mês da DATA DO PAGAMENTO (ou da data do lançamento, se não houver).
//  - Em aberto: entrada ainda não recebida (nem cancelada/estornada) ou cobrança (pagamentos) pendente/atrasada.
//  - Vencido: em aberto com vencimento anterior a hoje.
//  - Inadimplente: aluno ativo com algum item vencido em aberto OU com a data de vencimento do cadastro já passada.
//  - Receita prevista do período: recebida no período + em aberto com vencimento no período.
//  - Cobrança paga pelo Asaas aparece uma vez só: vira entrada no financeiro e a cobrança sai de "em aberto".

export type AlunoP = {
  id: string
  status: string | null
  data_cadastro: string | null
  data_inativacao: string | null
  data_vencimento: string | null
}
export type MatP = { aluno_id: string; tipo: string; valor: number | null }
export type MovP = {
  tipo: string
  status: string | null
  valor: number
  data: string
  data_pagamento: string | null
  data_vencimento: string | null
  aluno_ref_id: string | null
}
export type PagP = { aluno_id: string | null; valor: number | null; status: string | null; data_vencimento: string | null }

export type Periodo = { inicio: string; fim: string; inicioAnt: string; fimAnt: string }
export type Preset = 'mes_atual' | 'mes_anterior' | '3m' | '6m' | 'custom'

/* ---------- datas ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
export const somarDias = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * 86400000))
export const diasEntre = (de: string, ate: string) => Math.round((parse(ate).getTime() - parse(de).getTime()) / 86400000)
const primeiroDoMes = (y: number, m0: number) => iso(new Date(Date.UTC(y, m0, 1)))
const ultimoDoMes = (y: number, m0: number) => iso(new Date(Date.UTC(y, m0 + 1, 0)))
export const mesDe = (s: string) => s.slice(0, 7)

/** Período escolhido e o período equivalente anterior (mesmo tamanho). */
export function periodoDe(preset: Preset, hoje: string, de?: string, ate?: string): Periodo {
  const d = parse(hoje)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  if (preset === 'mes_atual') {
    const inicio = primeiroDoMes(y, m)
    const n = diasEntre(inicio, hoje) + 1
    const inicioAnt = primeiroDoMes(y, m - 1)
    const fimMesAnt = ultimoDoMes(y, m - 1)
    const fimAnt = somarDias(inicioAnt, n - 1) > fimMesAnt ? fimMesAnt : somarDias(inicioAnt, n - 1)
    return { inicio, fim: hoje, inicioAnt, fimAnt }
  }
  if (preset === 'mes_anterior') {
    return { inicio: primeiroDoMes(y, m - 1), fim: ultimoDoMes(y, m - 1), inicioAnt: primeiroDoMes(y, m - 2), fimAnt: ultimoDoMes(y, m - 2) }
  }
  if (preset === '3m' || preset === '6m') {
    const n = preset === '3m' ? 3 : 6
    return {
      inicio: primeiroDoMes(y, m - (n - 1)), fim: hoje,
      inicioAnt: primeiroDoMes(y, m - (2 * n - 1)), fimAnt: ultimoDoMes(y, m - n),
    }
  }
  const inicio = de && ate && de <= ate ? de : hoje
  const fim = de && ate && de <= ate ? ate : hoje
  const n = diasEntre(inicio, fim) + 1
  return { inicio, fim, inicioAnt: somarDias(inicio, -n), fimAnt: somarDias(inicio, -1) }
}

export const dentro = (data: string | null | undefined, inicio: string, fim: string) => !!data && data >= inicio && data <= fim

/** Meses ('AAAA-MM') de uma janela que termina em `fim` e tem pelo menos `minimo` meses (para ver a tendência). */
export function mesesDaJanela(inicio: string, fim: string, minimo = 6) {
  const [yf, mf] = fim.split('-').map(Number)
  const [yi, mi] = inicio.split('-').map(Number)
  const doPeriodo = (yf - yi) * 12 + (mf - mi) + 1
  const n = Math.max(doPeriodo, minimo)
  const lista: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(yf, mf - 1 - i, 1))
    lista.push(`${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}`)
  }
  return lista
}

export function deslocarMes(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number)
  const x = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`
const arredonda = (n: number) => Math.round(n * 100) / 100

/* ---------- itens financeiros unificados ---------- */
export type Item = { alunoId: string | null; valor: number; estado: 'pago' | 'aberto' | 'cancelado'; vencimento: string | null; dataEfetiva: string }

const CANCELADOS = ['Cancelado', 'Estornado']

export function itensFinanceiros(movs: MovP[], pags: PagP[]): Item[] {
  const itens: Item[] = []
  for (const m of movs) {
    if (m.tipo !== 'Entrada') continue
    const estado = m.status === 'Recebido' ? 'pago' : CANCELADOS.includes(m.status ?? '') ? 'cancelado' : 'aberto'
    itens.push({ alunoId: m.aluno_ref_id, valor: Number(m.valor) || 0, estado, vencimento: m.data_vencimento ?? m.data, dataEfetiva: m.data_pagamento ?? m.data })
  }
  for (const p of pags) {
    if (p.status === 'Pago') continue // já está nas entradas do financeiro
    const estado = CANCELADOS.includes(p.status ?? '') ? 'cancelado' : 'aberto'
    if (!p.data_vencimento) continue // sem data não dá para classificar
    itens.push({ alunoId: p.aluno_id, valor: Number(p.valor) || 0, estado, vencimento: p.data_vencimento, dataEfetiva: p.data_vencimento })
  }
  return itens
}

/* ---------- filtro por modalidade ---------- */
export function alunosDaModalidade(mats: MatP[], modalidade: string | null) {
  if (!modalidade) return null
  return new Set(mats.filter(m => m.tipo === modalidade).map(m => m.aluno_id))
}

/* ---------- indicadores ---------- */
export type Kpis = {
  alunosAtivos: number
  recebida: number
  recebidaAnt: number
  prevista: number
  previstaAnt: number
  abertoQtd: number
  abertoValor: number
  vencidoQtd: number
  vencidoValor: number
  inadimplentes: number
  inadimplenciaPct: number | null // sobre os alunos ativos
  novos: number
  novosAnt: number
  inativacoes: number
  inativacoesAnt: number
  crescimento: number
  crescimentoAnt: number
  potencialMensal: number // soma das mensalidades (matrículas) dos alunos ativos
}

export function calcularKpis(args: {
  alunos: AlunoP[]; mats: MatP[]; itens: Item[]; periodo: Periodo; hoje: string; modalidade: string | null
}): Kpis {
  const { alunos, mats, itens, periodo, hoje } = args
  const da = alunosDaModalidade(mats, args.modalidade)
  const alunosF = da ? alunos.filter(a => da.has(a.id)) : alunos
  const itensF = da ? itens.filter(i => i.alunoId && da.has(i.alunoId)) : itens

  const ativos = alunosF.filter(a => a.status === 'Ativo')
  const idsAtivos = new Set(ativos.map(a => a.id))

  const recebidaEm = (i: string, f: string) => arredonda(itensF.filter(x => x.estado === 'pago' && dentro(x.dataEfetiva, i, f)).reduce((s, x) => s + x.valor, 0))
  const abertoComVencimentoEm = (i: string, f: string) => arredonda(itensF.filter(x => x.estado === 'aberto' && dentro(x.vencimento, i, f)).reduce((s, x) => s + x.valor, 0))

  const abertos = itensF.filter(x => x.estado === 'aberto')
  const vencidos = abertos.filter(x => x.vencimento && x.vencimento < hoje)

  const inad = new Set<string>()
  for (const v of vencidos) if (v.alunoId && idsAtivos.has(v.alunoId)) inad.add(v.alunoId)
  for (const a of ativos) if (a.data_vencimento && a.data_vencimento < hoje) inad.add(a.id)

  const novosEm = (i: string, f: string) => alunosF.filter(a => dentro(a.data_cadastro, i, f)).length
  const inativEm = (i: string, f: string) => alunosF.filter(a => dentro(a.data_inativacao, i, f)).length

  const novos = novosEm(periodo.inicio, periodo.fim)
  const novosAnt = novosEm(periodo.inicioAnt, periodo.fimAnt)
  const inativacoes = inativEm(periodo.inicio, periodo.fim)
  const inativacoesAnt = inativEm(periodo.inicioAnt, periodo.fimAnt)

  const recebida = recebidaEm(periodo.inicio, periodo.fim)
  const recebidaAnt = recebidaEm(periodo.inicioAnt, periodo.fimAnt)

  return {
    alunosAtivos: ativos.length,
    recebida,
    recebidaAnt,
    prevista: arredonda(recebida + abertoComVencimentoEm(periodo.inicio, periodo.fim)),
    previstaAnt: arredonda(recebidaAnt + abertoComVencimentoEm(periodo.inicioAnt, periodo.fimAnt)),
    abertoQtd: abertos.length,
    abertoValor: arredonda(abertos.reduce((s, x) => s + x.valor, 0)),
    vencidoQtd: vencidos.length,
    vencidoValor: arredonda(vencidos.reduce((s, x) => s + x.valor, 0)),
    inadimplentes: inad.size,
    inadimplenciaPct: ativos.length > 0 ? (inad.size / ativos.length) * 100 : null,
    novos, novosAnt, inativacoes, inativacoesAnt,
    crescimento: novos - inativacoes,
    crescimentoAnt: novosAnt - inativacoesAnt,
    potencialMensal: arredonda(mats.filter(m => idsAtivos.has(m.aluno_id) && (!args.modalidade || m.tipo === args.modalidade)).reduce((s, m) => s + (Number(m.valor) || 0), 0)),
  }
}

/** Variação percentual contra o período anterior; null quando não há base para comparar. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual === 0 ? 0 : null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

/* ---------- séries por mês ---------- */
export type LinhaFinanceira = { mes: string; rotulo: string; recebida: number; anterior: number; aReceber: number; prevista: number }

export function serieFinanceira(itens: Item[], meses: string[]): LinhaFinanceira[] {
  const deslocamento = meses.length
  const recebidaDo = (mes: string) => arredonda(itens.filter(x => x.estado === 'pago' && mesDe(x.dataEfetiva) === mes).reduce((s, x) => s + x.valor, 0))
  return meses.map(mes => {
    const recebida = recebidaDo(mes)
    const aReceber = arredonda(itens.filter(x => x.estado === 'aberto' && x.vencimento && mesDe(x.vencimento) === mes).reduce((s, x) => s + x.valor, 0))
    return { mes, rotulo: rotuloMes(mes), recebida, anterior: recebidaDo(deslocarMes(mes, -deslocamento)), aReceber, prevista: arredonda(recebida + aReceber) }
  })
}

export type LinhaAlunos = { mes: string; rotulo: string; novos: number; inativacoes: number; base: number }

/**
 * Novos x inativações por mês e a base estimada (total cadastrado até o mês menos as inativações com data registrada).
 * Alunos inativados antes do registro de datas não têm data: ficam fora das inativações e dentro da base.
 */
export function serieAlunos(alunos: AlunoP[], meses: string[]): LinhaAlunos[] {
  return meses.map(mes => {
    const fimMes = `${mes}-31`
    const novos = alunos.filter(a => a.data_cadastro && mesDe(a.data_cadastro) === mes).length
    const inativacoes = alunos.filter(a => a.data_inativacao && mesDe(a.data_inativacao) === mes).length
    const cadastrados = alunos.filter(a => a.data_cadastro && a.data_cadastro <= fimMes).length
    const inativados = alunos.filter(a => a.data_cadastro && a.data_cadastro <= fimMes && a.data_inativacao && a.data_inativacao <= fimMes).length
    return { mes, rotulo: rotuloMes(mes), novos, inativacoes, base: cadastrados - inativados }
  })
}

/* ---------- pagamentos ---------- */
export type FatiaStatus = { nome: 'Pagos' | 'A vencer' | 'Vencidos' | 'Cancelados'; qtd: number; valor: number }

/** Pagos e cancelados dentro do período; a vencer e vencidos são a carteira em aberto de hoje. */
export function statusDosPagamentos(itens: Item[], periodo: Periodo, hoje: string): FatiaStatus[] {
  const soma = (xs: Item[]) => arredonda(xs.reduce((s, x) => s + x.valor, 0))
  const pagos = itens.filter(x => x.estado === 'pago' && dentro(x.dataEfetiva, periodo.inicio, periodo.fim))
  const cancelados = itens.filter(x => x.estado === 'cancelado' && dentro(x.vencimento, periodo.inicio, periodo.fim))
  const abertos = itens.filter(x => x.estado === 'aberto')
  const vencidos = abertos.filter(x => x.vencimento && x.vencimento < hoje)
  const aVencer = abertos.filter(x => !x.vencimento || x.vencimento >= hoje)
  return [
    { nome: 'Pagos', qtd: pagos.length, valor: soma(pagos) },
    { nome: 'A vencer', qtd: aVencer.length, valor: soma(aVencer) },
    { nome: 'Vencidos', qtd: vencidos.length, valor: soma(vencidos) },
    { nome: 'Cancelados', qtd: cancelados.length, valor: soma(cancelados) },
  ]
}

export type FaixaAtraso = { faixa: 'Até 7 dias' | '8 a 30 dias' | 'Mais de 30 dias'; qtd: number; valor: number }

export function faixasDeAtraso(itens: Item[], hoje: string): FaixaAtraso[] {
  const faixas: FaixaAtraso[] = [
    { faixa: 'Até 7 dias', qtd: 0, valor: 0 },
    { faixa: '8 a 30 dias', qtd: 0, valor: 0 },
    { faixa: 'Mais de 30 dias', qtd: 0, valor: 0 },
  ]
  for (const x of itens) {
    if (x.estado !== 'aberto' || !x.vencimento || x.vencimento >= hoje) continue
    const dias = diasEntre(x.vencimento, hoje)
    const f = dias <= 7 ? faixas[0] : dias <= 30 ? faixas[1] : faixas[2]
    f.qtd += 1
    f.valor = arredonda(f.valor + x.valor)
  }
  return faixas
}

/** Participação de cada fatia no total, em %; vazio se o total for zero. */
export function participacao<T extends { total: number }>(linhas: T[]) {
  const soma = linhas.reduce((s, l) => s + l.total, 0)
  return linhas.map(l => ({ ...l, pct: soma > 0 ? (l.total / soma) * 100 : 0 }))
}
