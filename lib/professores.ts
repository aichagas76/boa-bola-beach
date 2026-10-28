import type { SupabaseClient } from '@supabase/supabase-js'

// Professores e os esportes em que dão aula (sem banco, para poder ser testado).
export type ProfessorOpcao = { id: string; nome: string; esporteIds: string[] }

/** Professores que aparecem para um esporte. Quem ainda não tem esporte marcado aparece em todos; o já escolhido nunca some da lista. */
export function professoresDoEsporte(lista: ProfessorOpcao[], esporteId: string, escolhidoNome?: string): ProfessorOpcao[] {
  return lista.filter(p => p.esporteIds.length === 0 || p.esporteIds.includes(esporteId) || (!!escolhidoNome && p.nome === escolhidoNome))
}

/** Professores ativos com seus esportes. Se a tabela de esportes do professor ainda não existir no banco, devolve sem esportes. */
export async function carregarProfessoresAtivos(db: SupabaseClient): Promise<ProfessorOpcao[]> {
  const comEsportes = await db.from('professores').select('id, nome, professor_esportes(esporte_id)').eq('ativo', true).order('nome')
  if (!comEsportes.error) {
    return ((comEsportes.data ?? []) as { id: string; nome: string; professor_esportes: { esporte_id: string }[] | null }[])
      .map(p => ({ id: p.id, nome: p.nome, esporteIds: (p.professor_esportes ?? []).map(x => x.esporte_id) }))
  }
  const simples = await db.from('professores').select('id, nome').eq('ativo', true).order('nome')
  return ((simples.data ?? []) as { id: string; nome: string }[]).map(p => ({ ...p, esporteIds: [] }))
}
