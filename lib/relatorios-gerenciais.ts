// Relatórios gerenciais (sem banco, para poderem ser testados).
//  1) Pagamento dos professores no mês de competência (comissão das aulas pagas, comissão extra e descontos).
//  2) Faturamento e lucro líquido por esporte.
//
// Competência: o mês a que a mensalidade se refere (o mês do vencimento), não o mês em que foi paga.

export type ProfessorR = { id: string; nome: string; comissao_percentual: number | null }
export type AlunoR = {
  id: string; nome: string; status: string | null
  data_cadastro: string | null; data_inativacao: string | null; data_vencimento: string | null
}
export type MatriculaR = {
  aluno_id: string; tipo: string; valor: number | null
  professor_id: string | null; professor_nome: string | null; esporte_nome: string | null
  unidade_id: string | null; acesso_duas_unidades: boolean | null
}
export type EntradaRecebida = { aluno_ref_id: string | null; valor: number; competencia: string; data_pagamento?: string | null }

export const normaliza = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const arredonda = (n: number) => Math.round(n * 100) / 100
const ultimoDia = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Mês de competência de uma entrada: o do vencimento (ou, sem vencimento, o da data do lançamento). */
export const competenciaDe = (m: { data_vencimento: string | null; data: string }) => (m.data_vencimento ?? m.data).slice(0, 7)

export type Situacao = 'Pago' | 'Inadimplente' | 'A vencer'

export type DetalheAluno = {
  alunoId: string; nome: string; esporte: string
  competencia: string // mês a que a mensalidade se refere
  dataPagamento: string | null // quando o aluno pagou (a mais recente da competência)
  valorProfessor: number // mensalidade da aula com este professor
  totalAluno: number // tudo que o aluno paga na unidade
  recebido: number // recebido na competência
  situacao: Situacao
  comissao: number // comissão se a mensalidade estivesse toda paga
  paga: number // comissão sobre o que foi pago: entra no pagamento
  foraDoPagamento: number // comissão do que ainda não foi pago: aparece, mas não é paga
}

/** Lançamento do Financeiro ligado ao professor que muda o que ele recebe no mês. */
export type MovProfessor = {
  professor_id: string | null
  tipo: string // 'Entrada' | 'Saída'
  status: string | null
  valor: number
  data: string
  data_pagamento: string | null
  data_vencimento: string | null
  descricao: string | null
  categoria: string | null
  subcategoria: string | null
  aluno_ref_id: string | null
  esporte_nome: string | null
}
export type Ajuste = { data: string; descricao: string; tipoAjuste: string; status: string; valor: number; contaNoTotal: number }

export type LinhaComissao = {
  professor: string
  percentual: number | null
  semPercentual: boolean
  alunos: number
  base: number // mensalidades com o professor no mês
  comissaoTotal: number // comissão se tudo estivesse pago
  paga: number // comissão das aulas já pagas pelos alunos (entra no pagamento)
  foraDoPagamento: number // comissão do que não foi pago
  extras: Ajuste[] // comissão de venda de produto, encordoamento e ranking
  totalExtras: number
  descontos: Ajuste[] // vales, adiantamentos, outras despesas e retiradas de produtos
  totalDescontos: number
  aPagar: number // paga + extras − descontos
  detalhe: DetalheAluno[]
}

const EXTRAS = ['comissao de venda', 'comissao de encordoamento', 'comissao ranking']
const ROTULO_EXTRA: Record<string, string> = { 'comissao de venda': 'Comissão de venda de produto', 'comissao de encordoamento': 'Comissão de encordoamento', 'comissao ranking': 'Comissão de ranking' }

/** Mês em que o lançamento conta: o do pagamento, se já foi pago; senão o do vencimento. */
const mesDoAjuste = (m: MovProfessor) => {
  const pago = (m.tipo === 'Saída' && m.status === 'Pago') || (m.tipo === 'Entrada' && m.status === 'Recebido')
  return (pago ? (m.data_pagamento ?? m.data) : (m.data_vencimento ?? m.data)).slice(0, 7)
}

/** Separa um lançamento do professor em comissão extra, desconto ou nada (não é do relatório). */
export function classificarAjuste(m: MovProfessor): { grupo: 'extra' | 'desconto'; ajuste: Ajuste } | null {
  if (m.status === 'Cancelado' || m.status === 'Estornado') return null
  const sub = normaliza(m.subcategoria)
  const cat = normaliza(m.categoria)
  const data = m.data_pagamento ?? m.data
  const status = m.status ?? ''
  if (m.tipo === 'Saída') {
    if (EXTRAS.includes(sub)) {
      return { grupo: 'extra', ajuste: { data, descricao: m.descricao ?? ROTULO_EXTRA[sub], tipoAjuste: ROTULO_EXTRA[sub], status, valor: m.valor, contaNoTotal: m.valor } }
    }
    const nome = [m.categoria, m.subcategoria].filter(Boolean).join(' · ') || 'Despesa'
    return { grupo: 'desconto', ajuste: { data, descricao: m.descricao ?? nome, tipoAjuste: nome, status, valor: m.valor, contaNoTotal: m.valor } }
  }
  // Retirada de produto pelo próprio professor: desconta enquanto não foi paga na hora
  if (m.tipo === 'Entrada' && !m.aluno_ref_id && cat.includes('produto')) {
    const pago = m.status === 'Recebido'
    return { grupo: 'desconto', ajuste: { data: m.data, descricao: m.descricao ?? 'Retirada de produto', tipoAjuste: 'Retirada de produto', status: pago ? 'Já pago' : status, valor: m.valor, contaNoTotal: pago ? 0 : m.valor } }
  }
  return null
}

/**
 * Pagamento do professor no mês de competência:
 *  - Comissão das aulas = mensalidade do aluno com o professor × % do professor, SÓ sobre o que o aluno pagou.
 *    Quem não pagou aparece na lista, mas a comissão dele fica fora do pagamento.
 *  - Comissão extra = comissão de venda de produto, de encordoamento e de ranking lançadas no Financeiro.
 *  - Descontos = vales, adiantamentos e demais despesas lançadas para o professor, e retiradas de produto ainda não pagas.
 *  - A pagar = comissão das aulas pagas + comissão extra − descontos.
 */
export function comissaoPorProfessor(args: {
  mes: string
  hoje: string
  professores: ProfessorR[]
  alunos: AlunoR[]
  matriculas: MatriculaR[]
  entradas: EntradaRecebida[]
  movimentos?: MovProfessor[]
  unidadeId: string | null
  filtroProfessorId?: string | null
  filtroEsporte?: string | null
}) {
  const { mes, hoje, unidadeId } = args
  const inicio = `${mes}-01`
  const fim = `${mes}-${String(ultimoDia(mes)).padStart(2, '0')}`
  const alunosPorId = new Map(args.alunos.map(a => [a.id, a]))

  const elegivel = (a: AlunoR) =>
    !!a.data_cadastro && a.data_cadastro <= fim && (a.status === 'Ativo' || (!!a.data_inativacao && a.data_inativacao >= inicio))

  // Na unidade escolhida só entra o que é dela (o combo vale metade em cada unidade)
  const valorNaUnidade = (m: MatriculaR) => {
    const v = Number(m.valor) || 0
    if (!unidadeId || m.unidade_id === unidadeId) return m.acesso_duas_unidades ? arredonda(v / 2) : v
    return m.acesso_duas_unidades ? arredonda(v - arredonda(v / 2)) : 0
  }
  const totalAluno = new Map<string, number>()
  for (const m of args.matriculas) totalAluno.set(m.aluno_id, arredonda((totalAluno.get(m.aluno_id) ?? 0) + valorNaUnidade(m)))

  const recebidoNoMes = new Map<string, number>()
  const pagoEm = new Map<string, string>()
  for (const e of args.entradas) {
    if (!e.aluno_ref_id || e.competencia !== mes) continue
    recebidoNoMes.set(e.aluno_ref_id, arredonda((recebidoNoMes.get(e.aluno_ref_id) ?? 0) + e.valor))
    if (e.data_pagamento && e.data_pagamento > (pagoEm.get(e.aluno_ref_id) ?? '')) pagoEm.set(e.aluno_ref_id, e.data_pagamento)
  }

  const situacaoDe = (a: AlunoR, total: number, recebido: number): Situacao => {
    if (recebido + 0.009 >= total) return 'Pago'
    const dia = a.data_vencimento ? Math.min(Number(a.data_vencimento.slice(8, 10)), ultimoDia(mes)) : ultimoDia(mes)
    const vencimento = `${mes}-${String(dia).padStart(2, '0')}`
    return vencimento < hoje ? 'Inadimplente' : 'A vencer'
  }

  const porNome = new Map(args.professores.map(p => [normaliza(p.nome), p]))
  const porId = new Map(args.professores.map(p => [p.id, p]))
  const linhas = new Map<string, LinhaComissao>()
  const novaLinha = (nome: string, percentual: number | null): LinhaComissao => ({
    professor: nome, percentual, semPercentual: percentual === null,
    alunos: 0, base: 0, comissaoTotal: 0, paga: 0, foraDoPagamento: 0,
    extras: [], totalExtras: 0, descontos: [], totalDescontos: 0, aPagar: 0, detalhe: [],
  })

  for (const m of args.matriculas) {
    const aluno = alunosPorId.get(m.aluno_id)
    if (!aluno || !elegivel(aluno)) continue
    if (!m.professor_id && !m.professor_nome) continue
    const prof = (m.professor_id && porId.get(m.professor_id)) || porNome.get(normaliza(m.professor_nome))
    const chave = prof?.id ?? `sem-cadastro:${normaliza(m.professor_nome)}`
    if (args.filtroProfessorId && prof?.id !== args.filtroProfessorId) continue
    if (args.filtroEsporte && (m.esporte_nome ?? 'Sem esporte') !== args.filtroEsporte) continue

    const valorProf = valorNaUnidade(m)
    if (valorProf <= 0) continue
    const total = totalAluno.get(aluno.id) ?? 0
    const recebido = recebidoNoMes.get(aluno.id) ?? 0
    const situacao = situacaoDe(aluno, total, recebido)
    const fracaoPaga = total > 0 ? Math.min(1, recebido / total) : 0
    const percentual = prof?.comissao_percentual ?? null
    const comissao = arredonda(valorProf * ((percentual ?? 0) / 100))
    const paga = arredonda(comissao * fracaoPaga)

    const linha = linhas.get(chave) ?? novaLinha(prof?.nome ?? m.professor_nome ?? 'Professor', percentual)
    linha.detalhe.push({
      alunoId: aluno.id, nome: aluno.nome, esporte: m.esporte_nome ?? 'Sem esporte', competencia: mes, dataPagamento: pagoEm.get(aluno.id) ?? null,
      valorProfessor: valorProf, totalAluno: total, recebido, situacao, comissao, paga, foraDoPagamento: arredonda(comissao - paga),
    })
    linha.base = arredonda(linha.base + valorProf)
    linha.comissaoTotal = arredonda(linha.comissaoTotal + comissao)
    linha.paga = arredonda(linha.paga + paga)
    linhas.set(chave, linha)
  }

  // Comissão extra e descontos lançados no Financeiro (o professor aparece mesmo sem aluno no mês)
  for (const mov of args.movimentos ?? []) {
    if (!mov.professor_id || mesDoAjuste(mov) !== mes) continue
    if (args.filtroProfessorId && mov.professor_id !== args.filtroProfessorId) continue
    if (args.filtroEsporte && mov.esporte_nome && mov.esporte_nome !== args.filtroEsporte) continue
    const classe = classificarAjuste(mov)
    if (!classe) continue
    const prof = porId.get(mov.professor_id)
    if (!prof) continue
    const linha = linhas.get(prof.id) ?? novaLinha(prof.nome, prof.comissao_percentual)
    if (classe.grupo === 'extra') { linha.extras.push(classe.ajuste); linha.totalExtras = arredonda(linha.totalExtras + classe.ajuste.contaNoTotal) }
    else { linha.descontos.push(classe.ajuste); linha.totalDescontos = arredonda(linha.totalDescontos + classe.ajuste.contaNoTotal) }
    linhas.set(prof.id, linha)
  }

  const ordemData = (a: Ajuste, b: Ajuste) => a.data.localeCompare(b.data)
  const lista = Array.from(linhas.values()).map(l => {
    const detalhe = [...l.detalhe].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.esporte.localeCompare(b.esporte, 'pt-BR'))
    const foraDoPagamento = arredonda(l.comissaoTotal - l.paga)
    return {
      ...l, detalhe, foraDoPagamento, alunos: new Set(l.detalhe.map(d => d.alunoId)).size,
      extras: [...l.extras].sort(ordemData), descontos: [...l.descontos].sort(ordemData),
      aPagar: arredonda(l.paga + l.totalExtras - l.totalDescontos),
    }
  }).sort((a, b) => a.professor.localeCompare(b.professor, 'pt-BR'))
  const soma = (f: (l: LinhaComissao) => number) => arredonda(lista.reduce((s, l) => s + f(l), 0))
  return {
    linhas: lista,
    totais: {
      base: soma(l => l.base), comissaoTotal: soma(l => l.comissaoTotal), paga: soma(l => l.paga), foraDoPagamento: soma(l => l.foraDoPagamento),
      extras: soma(l => l.totalExtras), descontos: soma(l => l.totalDescontos), aPagar: soma(l => l.aPagar),
    },
  }
}

/* ---------- faturamento e lucro por esporte ---------- */
export type MovEsporte = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; esporte_nome: string | null
}
export type LinhaEsporte = {
  esporte: string
  faturamento: number
  despesas: number // despesas lançadas direto neste esporte
  resultado: number // faturamento − despesas diretas
  rateio: number // parte das despesas gerais (só quando o rateio está ligado)
  lucro: number // resultado − rateio
}

/**
 * Faturamento = entradas recebidas no período; despesas = saídas pagas no período.
 * Despesa sem esporte é "geral": por padrão fica à parte; com `ratear` é dividida em proporção ao faturamento.
 * O lucro líquido total é sempre faturamento total − todas as despesas.
 */
export function faturamentoPorEsporte(args: { movs: MovEsporte[]; inicio: string; fim: string; ratear: boolean }) {
  const dentro = (m: MovEsporte) => { const d = m.data_pagamento ?? m.data; return d >= args.inicio && d <= args.fim }
  const entradas = args.movs.filter(m => m.tipo === 'Entrada' && m.status === 'Recebido' && dentro(m))
  const saidas = args.movs.filter(m => m.tipo === 'Saída' && m.status === 'Pago' && dentro(m))

  const fat = new Map<string, number>()
  const desp = new Map<string, number>()
  for (const m of entradas) { const e = m.esporte_nome ?? 'Sem esporte'; fat.set(e, arredonda((fat.get(e) ?? 0) + m.valor)) }
  let gerais = 0
  for (const m of saidas) {
    if (m.esporte_nome) desp.set(m.esporte_nome, arredonda((desp.get(m.esporte_nome) ?? 0) + m.valor))
    else gerais = arredonda(gerais + m.valor)
  }

  const nomes = Array.from(new Set([...fat.keys(), ...desp.keys()])).sort((a, b) => (a === 'Sem esporte' ? 1 : b === 'Sem esporte' ? -1 : a.localeCompare(b, 'pt-BR')))
  const faturamentoTotal = arredonda(Array.from(fat.values()).reduce((s, v) => s + v, 0))
  const despesasDiretas = arredonda(Array.from(desp.values()).reduce((s, v) => s + v, 0))

  const linhas: LinhaEsporte[] = nomes.map(e => {
    const faturamento = fat.get(e) ?? 0
    const despesas = desp.get(e) ?? 0
    const rateio = args.ratear && faturamentoTotal > 0 ? arredonda(gerais * (faturamento / faturamentoTotal)) : 0
    return { esporte: e, faturamento, despesas, resultado: arredonda(faturamento - despesas), rateio, lucro: arredonda(faturamento - despesas - rateio) }
  })
  return {
    linhas,
    despesasGerais: gerais,
    totais: {
      faturamento: faturamentoTotal,
      despesas: arredonda(despesasDiretas + gerais),
      lucro: arredonda(faturamentoTotal - despesasDiretas - gerais),
    },
  }
}

/* ---------- exportação ---------- */
/** CSV com ponto e vírgula e vírgula decimal, para abrir direto no Excel em português. */
export function paraCsv(linhas: (string | number)[][]) {
  const celula = (v: string | number) => {
    const t = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '﻿' + linhas.map(l => l.map(celula).join(';')).join('\r\n')
}

/* ---------- comparação entre períodos ---------- */
export type MovComparacao = {
  tipo: string; status: string | null; valor: number; data: string; data_pagamento: string | null; categoria: string | null
}
export type AlunoComparacao = { data_cadastro: string | null; data_saida: string | null }
export type LinhaComparacao = { chave: string; rotulo: string; atual: number; anterior: number; diferenca: number; variacaoPct: number | null; dinheiro: boolean; subiuEhBom: boolean }

const dataDoMov = (m: { data: string; data_pagamento: string | null }) => m.data_pagamento ?? m.data
const dentroDe = (d: string | null, i: string, f: string) => !!d && d >= i && d <= f

/** Mesmos indicadores em dois períodos, lado a lado, com a diferença e a variação em %. */
export function compararPeriodos(args: {
  movs: MovComparacao[]; alunos: AlunoComparacao[]
  atual: { inicio: string; fim: string }; anterior: { inicio: string; fim: string }
}): LinhaComparacao[] {
  const soma = (f: (m: MovComparacao) => boolean, p: { inicio: string; fim: string }) =>
    arredonda(args.movs.filter(m => f(m) && dentroDe(dataDoMov(m), p.inicio, p.fim)).reduce((s, m) => s + Number(m.valor), 0))
  const recebido = (m: MovComparacao) => m.tipo === 'Entrada' && m.status === 'Recebido'
  const pago = (m: MovComparacao) => m.tipo === 'Saída' && m.status === 'Pago'
  const venda = (m: MovComparacao) => recebido(m) && normaliza(m.categoria).includes('produto')
  const contagem = (campo: 'data_cadastro' | 'data_saida', p: { inicio: string; fim: string }) => args.alunos.filter(a => dentroDe(a[campo], p.inicio, p.fim)).length

  const linha = (chave: string, rotulo: string, a: number, b: number, dinheiro: boolean, subiuEhBom = true): LinhaComparacao =>
    ({ chave, rotulo, atual: a, anterior: b, diferenca: arredonda(a - b), variacaoPct: b === 0 ? null : arredonda(((a - b) / Math.abs(b)) * 100), dinheiro, subiuEhBom })
  const A = args.atual, B = args.anterior
  const fat = [soma(recebido, A), soma(recebido, B)]
  const desp = [soma(pago, A), soma(pago, B)]
  return [
    linha('faturamento', 'Faturamento (entradas recebidas)', fat[0], fat[1], true),
    linha('despesas', 'Despesas pagas', desp[0], desp[1], true, false),
    linha('lucro', 'Lucro líquido', arredonda(fat[0] - desp[0]), arredonda(fat[1] - desp[1]), true),
    linha('vendas', 'Vendas de produtos', soma(venda, A), soma(venda, B), true),
    linha('novos', 'Alunos novos', contagem('data_cadastro', A), contagem('data_cadastro', B), false),
    linha('inativacoes', 'Inativações', contagem('data_saida', A), contagem('data_saida', B), false, false),
  ]
}

/* ---------- relatório de estoque ---------- */
export type ProdutoEstoque = { id: string; nome: string; categoria: string | null; custo: number; limite_compra: number }
export type RetiradaEstoque = { produto_id: string; data: string; quantidade: number; preco_unitario: number; custo_unitario: number }
export type CompraEstoque = { produto_id: string; data: string; quantidade: number; custo_unitario: number }
export type LinhaEstoque = {
  id: string; nome: string; categoria: string | null; saldo: number; limite: number
  vendidos: number; faturamento: number; custoVendido: number; lucro: number; comprados: number; gastoCompras: number
  situacao: 'COMPRAR' | 'ATENÇÃO' | 'OK'
}

/** Vendas, lucro e compras de cada produto no período, mais o saldo de hoje. Lucro = (preço − custo) × quantidade vendida. */
export function relatorioEstoque(args: {
  produtos: ProdutoEstoque[]; retiradas: RetiradaEstoque[]; compras: CompraEstoque[]; saldos: Record<string, number>; inicio: string; fim: string
}) {
  const linhas: LinhaEstoque[] = args.produtos.map(p => {
    const vs = args.retiradas.filter(r => r.produto_id === p.id && dentroDe(r.data, args.inicio, args.fim))
    const cs = args.compras.filter(c => c.produto_id === p.id && dentroDe(c.data, args.inicio, args.fim))
    const faturamento = arredonda(vs.reduce((s, r) => s + r.quantidade * r.preco_unitario, 0))
    const custoVendido = arredonda(vs.reduce((s, r) => s + r.quantidade * r.custo_unitario, 0))
    const saldo = args.saldos[p.id] ?? 0
    const situacao: LinhaEstoque['situacao'] = saldo <= 0 ? 'COMPRAR' : saldo <= p.limite_compra ? 'ATENÇÃO' : 'OK'
    return {
      id: p.id, nome: p.nome, categoria: p.categoria, saldo, limite: p.limite_compra,
      vendidos: vs.reduce((s, r) => s + r.quantidade, 0), faturamento, custoVendido, lucro: arredonda(faturamento - custoVendido),
      comprados: cs.reduce((s, c) => s + c.quantidade, 0), gastoCompras: arredonda(cs.reduce((s, c) => s + c.quantidade * c.custo_unitario, 0)), situacao,
    }
  }).sort((a, b) => b.lucro - a.lucro || b.vendidos - a.vendidos || a.nome.localeCompare(b.nome, 'pt-BR'))
  const soma = (f: (l: LinhaEstoque) => number) => arredonda(linhas.reduce((s, l) => s + f(l), 0))
  return { linhas, totais: { faturamento: soma(l => l.faturamento), lucro: soma(l => l.lucro), vendidos: soma(l => l.vendidos), gastoCompras: soma(l => l.gastoCompras) } }
}
