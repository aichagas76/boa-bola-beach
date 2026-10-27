import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { exigirAdministrador } from '@/lib/admin-usuarios'
import { validarAcessos, validarMudancaPerfil, validarNovoUsuario } from '@/lib/usuarios-regras'

export const runtime = 'nodejs'

/** Lista os logins, a que unidades cada um tem acesso e quem é administrador. */
export async function GET() {
  const ctx = await exigirAdministrador()
  if ('erro' in ctx) return ctx.erro

  const db = getSupabaseAdmin()
  const [{ data: lista, error }, { data: acessos }, { data: admins }, { data: unidades }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 200 }),
    db.from('acessos').select('user_id, unidade_id'),
    db.from('administradores').select('user_id'),
    db.from('unidades').select('id, codigo, nome').eq('ativo', true).order('nome'),
  ])
  if (error) return NextResponse.json({ error: 'Não consegui listar os usuários.' }, { status: 500 })

  const admSet = new Set((admins ?? []).map(a => a.user_id))
  const usuarios = (lista?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    ultimoLogin: u.last_sign_in_at ?? null,
    administrador: admSet.has(u.id),
    unidadeIds: (acessos ?? []).filter(a => a.user_id === u.id).map(a => a.unidade_id),
  }))
  return NextResponse.json({ usuarios, unidades: unidades ?? [], eu: ctx.userId })
}

/**
 * Body: { acao: 'criar', email, senha, unidadeIds, gestora } -> cria o login já confirmado e libera as unidades
 *       { acao: 'perfil', userId, gestora }          -> promove ou rebaixa (gestora altera cadastros e lê os logs)
 *       { acao: 'acessos', userId, unidadeIds }      -> troca as unidades de um login
 * A senha é digitada pelo administrador na tela; ela não é guardada nem mostrada depois.
 */
export async function POST(request: NextRequest) {
  const ctx = await exigirAdministrador()
  if ('erro' in ctx) return ctx.erro

  const body = await request.json()
  const db = getSupabaseAdmin()
  const { data: unidades } = await db.from('unidades').select('id')
  const existentes = (unidades ?? []).map(u => u.id)

  if (body.acao === 'criar') {
    const unidadeIds: string[] = Array.isArray(body.unidadeIds) ? body.unidadeIds : []
    const erros = validarNovoUsuario({ email: String(body.email ?? ''), senha: String(body.senha ?? ''), unidadeIds })
    const erroUnidade = validarAcessos(unidadeIds, existentes)
    if (erros.length > 0 || erroUnidade) return NextResponse.json({ error: [...erros, erroUnidade].filter(Boolean).join(' ') }, { status: 400 })

    const { data, error } = await db.auth.admin.createUser({
      email: String(body.email).trim().toLowerCase(),
      password: String(body.senha),
      email_confirm: true,
    })
    if (error || !data.user) {
      const jaExiste = /already|registered|exists/i.test(error?.message ?? '')
      return NextResponse.json({ error: jaExiste ? 'Já existe um login com este e-mail.' : 'Não consegui criar o login: ' + (error?.message ?? '') }, { status: 400 })
    }
    const { error: erroAcesso } = await db.from('acessos').insert(unidadeIds.map(unidade_id => ({ user_id: data.user!.id, unidade_id })))
    if (body.gestora === true) await db.from('administradores').insert({ user_id: data.user.id })
    if (erroAcesso) return NextResponse.json({ error: 'Login criado, mas não consegui liberar as unidades: ' + erroAcesso.message }, { status: 500 })
    await db.from('logs').insert({ usuario_email: 'sistema', acao: 'Criou usuário', tabela: 'auth.users', registro_id: data.user.id, detalhes: String(body.email) })
    return NextResponse.json({ success: true, id: data.user.id })
  }

  if (body.acao === 'acessos') {
    const unidadeIds: string[] = Array.isArray(body.unidadeIds) ? body.unidadeIds : []
    const erro = validarAcessos(unidadeIds, existentes)
    if (erro || !body.userId) return NextResponse.json({ error: erro ?? 'Usuário não informado.' }, { status: 400 })

    const { error: e1 } = await db.from('acessos').delete().eq('user_id', body.userId)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { error: e2 } = await db.from('acessos').insert(unidadeIds.map(unidade_id => ({ user_id: body.userId, unidade_id })))
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    await db.from('logs').insert({ usuario_email: 'sistema', acao: 'Alterou acessos', tabela: 'acessos', registro_id: body.userId, detalhes: unidadeIds.join(',') })
    return NextResponse.json({ success: true })
  }

  if (body.acao === 'perfil') {
    const { data: gestoras } = await db.from('administradores').select('user_id')
    const erro = validarMudancaPerfil({ userId: String(body.userId ?? ''), eu: ctx.userId, gestoras: (gestoras ?? []).map(g => g.user_id), virarGestora: body.gestora === true })
    if (erro || !body.userId) return NextResponse.json({ error: erro ?? 'Usuário não informado.' }, { status: 400 })
    const { error } = body.gestora === true
      ? await db.from('administradores').upsert({ user_id: body.userId })
      : await db.from('administradores').delete().eq('user_id', body.userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await db.from('logs').insert({ usuario_email: 'sistema', acao: body.gestora === true ? 'Promoveu a gestora' : 'Tirou de gestora', tabela: 'administradores', registro_id: body.userId })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
}
