import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { decidirAcessoAluno } from '@/lib/cobranca-regras'

export type AcessoAluno = { ok: true; devido: number } | { ok: false; status: number; erro: string }

/**
 * Confere, no servidor, se o login que chamou a rota pode mexer neste aluno (tem acesso à unidade dele)
 * e devolve quanto o aluno deve (mensalidades + produtos retirados e ainda não pagos).
 * As rotas que usam a chave administrativa (ignora o controle por unidade do banco) precisam passar por aqui.
 */
export async function autorizarAluno(alunoId: unknown): Promise<AcessoAluno> {
  const cookieStore = await cookies()
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await auth.auth.getUser()

  const id = typeof alunoId === 'string' && /^[0-9a-f-]{36}$/i.test(alunoId) ? alunoId : null
  const db = getSupabaseAdmin()
  const { data: aluno } = id ? await db.from('alunos').select('id, unidade_id').eq('id', id).maybeSingle() : { data: null }
  // O login só enxerga os próprios acessos (regra do banco), então esta leitura já é a lista dele
  const { data: acessos } = user ? await auth.from('acessos').select('unidade_id') : { data: [] }

  const decisao = decidirAcessoAluno({
    logado: !!user,
    alunoExiste: !!aluno,
    alunoUnidade: aluno?.unidade_id,
    unidadesDoLogin: (acessos ?? []).map(a => a.unidade_id as string),
  })
  if (!decisao.ok) return decisao

  const [{ data: mats }, { data: produtos }] = await Promise.all([
    db.from('matriculas').select('valor').eq('aluno_id', id!),
    db.from('movimentacoes').select('valor').eq('aluno_ref_id', id!).eq('tipo', 'Entrada').eq('origem', 'Estoque').eq('status', 'Não recebido'),
  ])
  const soma = (l: { valor: number | string | null }[] | null) => (l ?? []).reduce((a, x) => a + Number(x.valor ?? 0), 0)
  return { ok: true, devido: Math.round((soma(mats) + soma(produtos)) * 100) / 100 }
}
