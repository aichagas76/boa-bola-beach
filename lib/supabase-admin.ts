import { createClient } from '@supabase/supabase-js'

// Cliente com service role: só usar em rotas de servidor (ignora RLS)
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY não configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
