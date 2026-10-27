import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Verificação de saúde para monitoramento externo (ex.: UptimeRobot a cada 5 minutos).
 * Só diz se o sistema e o banco respondem; não devolve nenhum dado do negócio.
 */
export async function GET() {
  try {
    const { error } = await getSupabaseAdmin().from('unidades').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true, banco: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false, banco: 'falhou' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
