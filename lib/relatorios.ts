// Contas dos gráficos do Painel (sem banco, para poderem ser testadas).

export type Mov = {
  tipo: string // 'Entrada' | 'Saída'
  status: string | null
  valor: number
  data: string // AAAA-MM-DD
  data_pagamento: string | null
  professor_id: string | null
  professor_nome: string | null
  esporte_nome: string | null
}

export type AlunoSimples = { id: string; status: string | null }
export type MatriculaSimples = {
  aluno_id: string
  tipo: string
  unidade_id: string | null
  acesso_duas_unidades: boolean | null
  esporte_nome: string | null
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const SEM_ESPORTE = 'Sem esporte'

/** 'AAAA-MM' -> 'out/26' */
export function rotuloMes(mes: string) {
  const [a, m] = mes.split('-')
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`
}

/** Os últimos N meses (o atual incluído), do mais antigo para o mais novo. 'hoje' = AAAA-MM-DD. */
export function ultimosMeses(hoje: string, n: number) {
  const [a, m] = hoje.split('-').map(Number)
  const saida: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    saida.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return saida
}

/** Mês em que o dinheiro realmente entrou/saiu: data do pagamento, ou a data do lançamento se não houver. */
export const mesDoMovimento = (m: Mov) => (m.data_pagamento ?? m.data).slice(0, 7)

const recebida = (m: Mov) => m.tipo === 'Entrada' && m.status === 'Recebido'
const paga = (m: Mov) => m.tipo === 'Saída' && m.status === 'Pago'

export type LinhaMes = { mes: string; rotulo: string; bruto: number; despesas: number; lucro: number }

/** Faturamento bruto (entradas recebidas), despesas (saídas pagas) e lucro líquido por mês. */
export function resumoPorMes(movs: Mov[], meses: string[]): LinhaMes[] {
  return meses.map(mes => {
    const doMes = movs.filter(m => mesDoMovimento(m) === mes)
    const bruto = soma(doMes.filter(recebida))
    const despesas = soma(doMes.filter(paga))
    return { mes, rotulo: rotuloMes(mes), bruto, despesas, lucro: arredonda(bruto - despesas) }
  })
}

export function totaisDoPeriodo(linhas: LinhaMes[]) {
  const bruto = arredonda(linhas.reduce((a, l) => a + l.bruto, 0))
  const despesas = arredonda(linhas.reduce((a, l) => a + l.despesas, 0))
  return { bruto, despesas, lucro: arredonda(bruto - despesas) }
}

export type LinhaProfessor = { professor: string; total: number; [esporte: string]: number | string }

/** Faturamento (entradas recebidas) de cada professor, separado por esporte. */
export function faturamentoPorProfessor(movs: Mov[], meses: string[]) {
  const noPeriodo = new Set(meses)
  const porProf = new Map<string, Record<string, number>>()
  const esportes = new Set<string>()
  for (const m of movs) {
    if (!recebida(m) || !m.professor_id || !noPeriodo.has(mesDoMovimento(m))) continue
    const nome = m.professor_nome ?? 'Professor sem nome'
    const esporte = m.esporte_nome ?? SEM_ESPORTE
    esportes.add(esporte)
    const linha = porProf.get(nome) ?? {}
    linha[esporte] = arredonda((linha[esporte] ?? 0) + m.valor)
    porProf.set(nome, linha)
  }
  const dados: LinhaProfessor[] = Array.from(porProf.entries())
    .map(([professor, porEsporte]) => ({
      professor,
      ...porEsporte,
      total: arredonda(Object.values(porEsporte).reduce((a, v) => a + v, 0)),
    }))
    .sort((a, b) => b.total - a.total)
  return { dados, esportes: Array.from(esportes).sort() }
}

export type LinhaModalidade = { modalidade: string; total: number; [esporte: string]: number | string }

/**
 * Quantos alunos ativos há em cada modalidade, separados por esporte (um aluno conta uma vez por esporte+modalidade).
 * Na unidade escolhida entram as matrículas dela e as de combo (que valem nas duas).
 */
export function alunosPorModalidade(alunos: AlunoSimples[], matriculas: MatriculaSimples[], unidadeId: string | null) {
  const ativos = new Set(alunos.filter(a => a.status === 'Ativo').map(a => a.id))
  const vistos = new Set<string>()
  const contagem = new Map<string, Record<string, number>>()
  const esportes = new Set<string>()
  for (const m of matriculas) {
    if (!ativos.has(m.aluno_id)) continue
    if (unidadeId && m.unidade_id !== unidadeId && !m.acesso_duas_unidades) continue
    const esporte = m.esporte_nome ?? SEM_ESPORTE
    const chave = `${m.aluno_id}|${esporte}|${m.tipo}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    esportes.add(esporte)
    const linha = contagem.get(m.tipo) ?? {}
    linha[esporte] = (linha[esporte] ?? 0) + 1
    contagem.set(m.tipo, linha)
  }
  const dados: LinhaModalidade[] = Array.from(contagem.entries()).map(([modalidade, porEsporte]) => ({
    modalidade: modalidade === 'Aula' ? 'Aulas' : modalidade,
    ...porEsporte,
    total: Object.values(porEsporte).reduce((a, v) => a + v, 0),
  }))
  return { dados, esportes: Array.from(esportes).sort() }
}

function soma(movs: Mov[]) {
  return arredonda(movs.reduce((a, m) => a + Number(m.valor ?? 0), 0))
}
function arredonda(n: number) {
  return Math.round(n * 100) / 100
}
