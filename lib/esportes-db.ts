import type { SupabaseClient } from '@supabase/supabase-js'
import {
  estadoDasMatriculas, estadoVazio, extrasDe, idsParaApagar, matriculasParaGravar, modalidadesPorEsporte,
  type VinculoModalidadeEsporte,
  type EstadoEsporte, type MatriculaBanco,
} from '@/lib/esportes'

export type Unidade = { id: string; codigo: string; nome: string }
export type Esporte = { id: string; nome: string }

/** Esportes ativos, unidades a que o login atual tem acesso e modalidades ativas (as inativas não aparecem no cadastro). */
export async function carregarCatalogo(db: SupabaseClient) {
  const [{ data: esportes }, { data: unidades }, { data: acessos }, { data: modalidades, error: erroModalidades }, { data: vinculos, error: erroVinculos }] = await Promise.all([
    db.from('esportes').select('id, nome').eq('ativo', true).order('nome'),
    db.from('unidades').select('id, codigo, nome').eq('ativo', true).order('nome'),
    db.from('acessos').select('unidade_id'),
    db.from('modalidades').select('nome').eq('ativo', true).order('nome'),
    db.from('modalidade_esportes').select('esporte_id, modalidades(nome)'),
  ])
  const permitidas = new Set((acessos ?? []).map(a => a.unidade_id))
  const ativas = erroModalidades ? ['Clubinho', 'Aula', 'Ranking'] : (modalidades ?? []).map(m => m.nome as string)
  const listaEsportes = (esportes ?? []) as Esporte[]
  return {
    esportes: listaEsportes,
    // Para cada esporte, as modalidades ativas que valem nele (sem a tabela de vínculos, todas valem em todos)
    modalidadesPorEsporte: modalidadesPorEsporte(listaEsportes, ativas, erroVinculos ? null : ((vinculos ?? []) as unknown as VinculoModalidadeEsporte[])),
    unidades: ((unidades ?? []) as Unidade[]).filter(u => permitidas.has(u.id)),
    // Se a tabela de modalidades ainda não existir, cai nas três de sempre
    modalidades: ativas,
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
