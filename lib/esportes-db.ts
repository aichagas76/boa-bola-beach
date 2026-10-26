import type { SupabaseClient } from '@supabase/supabase-js'
import {
  estadoDasMatriculas, estadoVazio, idsParaApagar, matriculasParaGravar,
  type EstadoEsporte, type MatriculaBanco,
} from '@/lib/esportes'

export type Unidade = { id: string; codigo: string; nome: string }
export type Esporte = { id: string; nome: string }

/** Esportes ativos + unidades a que o login atual tem acesso. */
export async function carregarCatalogo(db: SupabaseClient) {
  const [{ data: esportes }, { data: unidades }, { data: acessos }] = await Promise.all([
    db.from('esportes').select('id, nome').eq('ativo', true).order('nome'),
    db.from('unidades').select('id, codigo, nome').eq('ativo', true).order('nome'),
    db.from('acessos').select('unidade_id'),
  ])
  const permitidas = new Set((acessos ?? []).map(a => a.unidade_id))
  return {
    esportes: (esportes ?? []) as Esporte[],
    unidades: ((unidades ?? []) as Unidade[]).filter(u => permitidas.has(u.id)),
  }
}

export function estadosIniciais(esportes: Esporte[], unidadeId: string): EstadoEsporte[] {
  return esportes.map(e => estadoVazio(e, unidadeId))
}

export function estadosDoAluno(esportes: Esporte[], matriculas: MatriculaBanco[], unidadeId: string) {
  return estadoDasMatriculas(esportes, matriculas, unidadeId)
}

/** Grava o estado do cadastro: cria, atualiza e apaga matrículas para ficar igual à tela. */
export async function salvarMatriculas(
  db: SupabaseClient, alunoId: string, estados: EstadoEsporte[], idsExistentes: string[]
) {
  const gravar = matriculasParaGravar(estados)

  for (const id of idsParaApagar(idsExistentes, gravar)) {
    const { error } = await db.from('matriculas').delete().eq('id', id)
    if (error) return error.message
  }
  for (const m of gravar) {
    const { id, ...campos } = m
    const { error } = id
      ? await db.from('matriculas').update(campos).eq('id', id)
      : await db.from('matriculas').insert({ ...campos, aluno_id: alunoId })
    if (error) return error.message
  }
  return null
}
