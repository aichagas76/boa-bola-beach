// Regras do cadastro de usuários (logins) e de a que unidades cada um tem acesso.

export type NovoUsuario = { email: string; senha: string; unidadeIds: string[] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Mensagens de erro, ou lista vazia se estiver tudo certo. */
export function validarNovoUsuario(u: NovoUsuario): string[] {
  const erros: string[] = []
  if (!EMAIL.test(u.email.trim())) erros.push('Informe um e-mail válido.')
  if (u.senha.length < 8) erros.push('A senha precisa ter pelo menos 8 caracteres.')
  if (u.unidadeIds.length === 0) erros.push('Escolha pelo menos uma unidade.')
  return erros
}

/** Troca de acessos: só aceita unidades que existem e nunca deixa o usuário sem nenhuma. */
export function validarAcessos(unidadeIds: string[], unidadesExistentes: string[]): string | null {
  if (unidadeIds.length === 0) return 'O usuário precisa ter pelo menos uma unidade.'
  const validas = new Set(unidadesExistentes)
  if (unidadeIds.some(id => !validas.has(id))) return 'Unidade inválida.'
  return null
}

/**
 * Troca de perfil (gestora ou não). Ninguém tira a própria permissão e sempre sobra ao menos uma gestora,
 * para o sistema nunca ficar sem quem gerencie logins e cadastros. Mensagem de erro, ou null.
 */
export function validarMudancaPerfil(p: { userId: string; eu: string; gestoras: string[]; virarGestora: boolean }): string | null {
  if (p.virarGestora) return null
  if (p.userId === p.eu) return 'Você não pode tirar a sua própria permissão de gestora.'
  const restantes = p.gestoras.filter(id => id !== p.userId)
  if (restantes.length === 0) return 'Precisa sobrar pelo menos uma gestora.'
  return null
}
