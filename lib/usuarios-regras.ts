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
