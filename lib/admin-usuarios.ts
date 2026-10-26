import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Confere no servidor que quem chamou está logado E é administrador (tabela administradores).
 * Devolve o id do usuário ou uma resposta de erro pronta.
 */
export async function exigirAdministrador(): Promise<{ userId: string } | { erro: NextResponse }> {
  const cookieStore = await cookies()
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const { data } = await getSupabaseAdmin().from('administradores').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!data) return { erro: NextResponse.json({ error: 'Só o administrador pode gerenciar usuários.' }, { status: 403 }) }
  return { userId: user.id }
}
