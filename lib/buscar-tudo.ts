// O Supabase devolve no máximo 1000 linhas por consulta (mesmo pedindo mais). Para telas que precisam de todos os registros
// (lista de alunos, financeiro, painel), esta função busca de 1000 em 1000 até acabar.
//
// Uso:  const { data, error } = await buscarTudo((de, ate) => supabase.from('alunos').select('id, nome').order('nome').order('id').range(de, ate))
// A consulta precisa ter uma ordem fixa (termine com .order('id')) para as páginas não se misturarem.

type Resposta<T> = { data: T[] | null; error: { message: string } | null }

export const TAMANHO_PAGINA = 1000
const MAX_PAGINAS = 100 // trava de segurança: 100 mil linhas

export async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  tamanho = TAMANHO_PAGINA
): Promise<Resposta<T>> {
  const tudo: T[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await consulta(pagina * tamanho, pagina * tamanho + tamanho - 1)
    if (error) return { data: null, error }
    tudo.push(...(data ?? []))
    if ((data?.length ?? 0) < tamanho) break
  }
  return { data: tudo, error: null }
}
