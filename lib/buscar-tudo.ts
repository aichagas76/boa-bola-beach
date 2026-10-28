// O Supabase devolve no máximo 1000 linhas por consulta (mesmo pedindo mais). Para telas que precisam de todos os registros
// (lista de alunos, financeiro, painel), esta função busca de 1000 em 1000 até acabar.
//
// Uso:  const { data, error } = await buscarTudo((de, ate) => supabase.from('alunos').select('id, nome').order('nome').order('id').range(de, ate))
// A consulta precisa ter uma ordem fixa (termine com .order('id')) para as páginas não se misturarem.

type Resposta<T> = { data: T[] | null; error: { message: string } | null }

export const TAMANHO_PAGINA = 1000
const MAX_PAGINAS = 100 // trava de segurança: 100 mil linhas
const EM_PARALELO = 6 // páginas pedidas ao mesmo tempo (as de uma rodada voltam em ordem)

export async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  tamanho = TAMANHO_PAGINA
): Promise<Resposta<T>> {
  const tudo: T[] = []
  for (let inicio = 0; inicio < MAX_PAGINAS; inicio += EM_PARALELO) {
    const rodada = await Promise.all(
      Array.from({ length: Math.min(EM_PARALELO, MAX_PAGINAS - inicio) }, (_, i) => {
        const pagina = inicio + i
        return consulta(pagina * tamanho, pagina * tamanho + tamanho - 1)
      })
    )
    for (const { error } of rodada) {
      if (error) return { data: null, error }
    }
    let acabou = false
    for (const { data } of rodada) {
      tudo.push(...(data ?? []))
      if ((data?.length ?? 0) < tamanho) { acabou = true; break }
    }
    if (acabou) break
  }
  return { data: tudo, error: null }
}
