import type { SupabaseClient } from '@supabase/supabase-js'
import {
  estadoDasMatriculas, estadoVazio, extrasDe, idsParaApagar, matriculasParaGravar,
  type EstadoEsporte, type MatriculaBanco,
} from '@/lib/esportes'

export type Unidade = { id: string; codigo: string; nome: string }
export type Esporte = { id: string; nome: string }

/** Esportes ativos, unidades a que o login atual tem acesso e modalidades ativas (as inativas não aparecem no cadastro). */
export async function carregarCatalogo(db: SupabaseClient) {
  const [{ data: esportes }, { data: unidades }, { data: acessos }, { data: modalidades, error: erroModalidades }] = await Promise.all([
    db.from('esportes').select('id, nome').eq('ativo', true).order('nome'),
    db.from('unidades').select('id, codigo, nome').eq('ativo', true).order('nome'),
    db.from('acessos').select('unidade_id'),
    db.from('modalidades').select('nome').eq('ativo', true).order('nome'),
  ])
  const permitidas = new Set((acessos ?? []).map(a => a.unidade_id))
  return {
    esportes: (esportes ?? []) as Esporte[],
    unidades: ((unidades ?? []) as Unidade[]).filter(u => permitidas.has(u.id)),
    // Se a tabela de modalidades ainda não existir, cai nas três de sempre
    modalidades: erroModalidades ? ['Clubinho', 'Aula', 'Ranking'] : (modalidades ?? []).map(m => m.nome as string),
  }
}

export function estadosIniciais(esportes: Esporte[], unidadeId: string, modalidades: string[] = []): EstadoEsporte[] {
  const extras = extrasDe(modalidades)
  return esportes.map(e => estadoVazio(e, unidadeId, extras))
}

export function estadosDoAluno(esportes: Esporte[], matriculas: MatriculaBanco[], unidadeId: string, modalidades: string[] = []) {
  return estadoDasMatriculas(esportes, matriculas, unidadeId, extrasDe(modalidades))
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
