import { supabase } from './supabase'

export async function registrarLog(acao: string, tabela?: string, registro_id?: string, detalhes?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('logs').insert({
    usuario_email: user?.email ?? 'desconhecido',
    acao,
    tabela,
    registro_id,
    detalhes,
  })
}
