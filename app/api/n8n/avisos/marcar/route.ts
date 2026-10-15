import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const COLUNA: Record<string, string> = {
  '3dias': 'aviso_3dias',
  vencimento: 'aviso_vencimento',
  '3diasAtraso': 'aviso_3dias_atraso',
  '6diasAtraso': 'aviso_6dias_atraso',
}

/**
 * O n8n chama depois de cada envio para registrar o resultado (SIM ou ERRO),
 * no lugar das atualizações que antes eram feitas na planilha.
 * Body: { RowId, tipoAviso, resultado }
 */
export async function POST(request: NextRequest) {
  const token = process.env.N8N_API_TOKEN
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { RowId, tipoAviso, resultado } = await request.json()
  const coluna = COLUNA[tipoAviso as string]
  if (!RowId || !coluna || !['SIM', 'ERRO'].includes(resultado)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('alunos')
    .update({ [coluna]: resultado })
    .eq('id', RowId)
  if (error) {
    console.error('[n8n/avisos/marcar] erro:', error)
    return NextResponse.json({ error: 'Erro ao registrar aviso' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
