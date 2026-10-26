// Modelo do cadastro: aluno -> esportes -> modalidades (Clubinho, Aula, Ranking).
// Funções puras (sem banco) para poderem ser testadas.

export type Modalidade = 'Clubinho' | 'Aula' | 'Ranking'

export type LinhaMatricula = {
  id: string | null // null = ainda não existe no banco
  tipo: Modalidade
  professor: string
  valor: string // texto digitado, ex.: "150" ou "150,00"
}

export type EstadoEsporte = {
  esporteId: string
  nome: string
  ativo: boolean
  unidadeId: string // unidade onde o aluno pratica este esporte
  clubinho: { ativo: boolean; id: string | null; valor: string; combo: boolean }
  aulas: { ativo: boolean; lista: LinhaMatricula[] }
  ranking: { ativo: boolean; id: string | null; valor: string }
}

export const MAX_AULAS_POR_ESPORTE = 2
export const ESPORTE_COM_COMBO = 'Beach Tênis'

/** "150" -> 150 · "150,50" -> 150.5 · "1.250,00" -> 1250 · vazio/lixo -> 0 */
export function parseValor(texto: string | number | null | undefined) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : 0
  const t = String(texto ?? '').trim()
  if (!t) return 0
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = parseFloat(limpo.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Mantém só dígitos e uma vírgula com até 2 casas, enquanto a pessoa digita. */
export function mascaraValor(v: string) {
  const [inteiro, ...resto] = v.replace(/[^0-9,]/g, '').split(',')
  return resto.length ? `${inteiro},${resto.join('').slice(0, 2)}` : inteiro
}

export function estadoVazio(esporte: { id: string; nome: string }, unidadeId: string): EstadoEsporte {
  return {
    esporteId: esporte.id,
    nome: esporte.nome,
    ativo: false,
    unidadeId,
    clubinho: { ativo: false, id: null, valor: '', combo: false },
    aulas: { ativo: false, lista: [{ id: null, tipo: 'Aula', professor: '', valor: '' }] },
    ranking: { ativo: false, id: null, valor: '' },
  }
}

export type MatriculaBanco = {
  id: string
  tipo: Modalidade
  valor: number | null
  professor_nome: string | null
  esporte_id: string | null
  unidade_id: string | null
  acesso_duas_unidades: boolean | null
}

/** Monta o estado das telas a partir das matrículas gravadas. */
export function estadoDasMatriculas(
  esportes: { id: string; nome: string }[],
  matriculas: MatriculaBanco[],
  unidadePadraoId: string
): EstadoEsporte[] {
  return esportes.map(e => {
    const est = estadoVazio(e, unidadePadraoId)
    const dele = matriculas.filter(m => m.esporte_id === e.id)
    if (dele.length === 0) return est
    est.ativo = true
    est.unidadeId = dele[0].unidade_id ?? unidadePadraoId
    const fmt = (v: number | null) => (v == null ? '' : String(v).replace('.', ','))
    const c = dele.find(m => m.tipo === 'Clubinho')
    if (c) est.clubinho = { ativo: true, id: c.id, valor: fmt(c.valor), combo: !!c.acesso_duas_unidades }
    const aulas = dele.filter(m => m.tipo === 'Aula')
    if (aulas.length) {
      est.aulas = {
        ativo: true,
        lista: aulas.map(a => ({ id: a.id, tipo: 'Aula' as const, professor: a.professor_nome ?? '', valor: fmt(a.valor) })),
      }
    }
    const r = dele.find(m => m.tipo === 'Ranking')
    if (r) est.ranking = { ativo: true, id: r.id, valor: fmt(r.valor) }
    return est
  })
}

export type MatriculaParaGravar = {
  id: string | null
  tipo: Modalidade
  esporte_id: string
  unidade_id: string
  valor: number
  professor_nome: string | null
  acesso_duas_unidades: boolean
}

/**
 * O que deve existir no banco para este estado. Esporte desligado = nenhuma matrícula dele.
 * Combo só vale para Clubinho de Beach Tênis.
 */
export function matriculasParaGravar(estados: EstadoEsporte[]): MatriculaParaGravar[] {
  const saida: MatriculaParaGravar[] = []
  for (const e of estados) {
    if (!e.ativo) continue
    const base = { esporte_id: e.esporteId, unidade_id: e.unidadeId }
    if (e.clubinho.ativo) {
      saida.push({
        ...base, id: e.clubinho.id, tipo: 'Clubinho', valor: parseValor(e.clubinho.valor), professor_nome: null,
        acesso_duas_unidades: e.nome === ESPORTE_COM_COMBO && e.clubinho.combo,
      })
    }
    if (e.aulas.ativo) {
      for (const a of e.aulas.lista.slice(0, MAX_AULAS_POR_ESPORTE)) {
        saida.push({ ...base, id: a.id, tipo: 'Aula', valor: parseValor(a.valor), professor_nome: a.professor || null, acesso_duas_unidades: false })
      }
    }
    if (e.ranking.ativo) {
      saida.push({ ...base, id: e.ranking.id, tipo: 'Ranking', valor: parseValor(e.ranking.valor), professor_nome: null, acesso_duas_unidades: false })
    }
  }
  return saida
}

/** Ids que existiam e não estão mais no estado (devem ser apagados). */
export function idsParaApagar(idsExistentes: string[], gravar: MatriculaParaGravar[]) {
  const mantidos = new Set(gravar.map(m => m.id).filter(Boolean))
  return idsExistentes.filter(id => !mantidos.has(id))
}

export function totalMensal(gravar: MatriculaParaGravar[]) {
  return gravar.reduce((acc, m) => acc + m.valor, 0)
}
