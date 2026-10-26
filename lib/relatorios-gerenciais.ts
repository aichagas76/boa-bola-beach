// Relatórios gerenciais (sem banco, para poderem ser testados).
//  1) Comissão dos professores no mês de competência.
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
export type EntradaRecebida = { aluno_ref_id: string | null; valor: number; competencia: string }

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
  valorProfessor: number // mensalidade da aula com este professor
  totalAluno: number // tudo que o aluno paga na unidade
  recebido: number // recebido na competência
  situacao: Situacao
  comissao: number
  descontado: number
  devido: number
}
export type LinhaComissao = {
  professor: string
  percentual: number | null
  semPercentual: boolean
  alunos: number
  base: number // mensalidades que geram comissão
  comissaoTotal: number
  descontado: number // comissão dos alunos inadimplentes
  devido: number // comissaoTotal − descontado
  detalhe: DetalheAluno[]
}

/**
 * Comissão = mensalidade do aluno com o professor × % do professor.
 * "Descontado" = a parte da comissão ligada ao que o aluno ainda não pagou, só quando ele está inadimplente
 * (vencimento do mês já passou). Aluno com vencimento ainda por chegar não é descontado.
 */
export function comissaoPorProfessor(args: {
  mes: string
  hoje: string
  professores: ProfessorR[]
  alunos: AlunoR[]
  matriculas: MatriculaR[]
  entradas: EntradaRecebida[]
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
  for (const e of args.entradas) {
    if (!e.aluno_ref_id || e.competencia !== mes) continue
    recebidoNoMes.set(e.aluno_ref_id, arredonda((recebidoNoMes.get(e.aluno_ref_id) ?? 0) + e.valor))
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
    const pendente = total > 0 ? Math.max(0, 1 - recebido / total) : 0
    const percentual = prof?.comissao_percentual ?? null
    const comissao = arredonda(valorProf * ((percentual ?? 0) / 100))
    const descontado = situacao === 'Inadimplente' ? arredonda(comissao * pendente) : 0

    const linha = linhas.get(chave) ?? {
      professor: prof?.nome ?? m.professor_nome ?? 'Professor', percentual, semPercentual: percentual === null,
      alunos: 0, base: 0, comissaoTotal: 0, descontado: 0, devido: 0, detalhe: [],
    }
    linha.detalhe.push({
      alunoId: aluno.id, nome: aluno.nome, esporte: m.esporte_nome ?? 'Sem esporte', valorProfessor: valorProf,
      totalAluno: total, recebido, situacao, comissao, descontado, devido: arredonda(comissao - descontado),
    })
    linha.base = arredonda(linha.base + valorProf)
    linha.comissaoTotal = arredonda(linha.comissaoTotal + comissao)
    linha.descontado = arredonda(linha.descontado + descontado)
    linha.devido = arredonda(linha.comissaoTotal - linha.descontado)
    linhas.set(chave, linha)
  }

  const lista = Array.from(linhas.values()).map(l => ({ ...l, alunos: new Set(l.detalhe.map(d => d.alunoId)).size }))
    .sort((a, b) => a.professor.localeCompare(b.professor, 'pt-BR'))
  const soma = (f: (l: LinhaComissao) => number) => arredonda(lista.reduce((s, l) => s + f(l), 0))
  return {
    linhas: lista,
    totais: { base: soma(l => l.base), comissaoTotal: soma(l => l.comissaoTotal), descontado: soma(l => l.descontado), devido: soma(l => l.devido) },
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
