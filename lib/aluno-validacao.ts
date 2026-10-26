// Validação e máscaras do cadastro de aluno (sem banco, para poderem ser testadas).
import { validarCPF, validarCelular } from './validators.ts'

export type DadosAluno = {
  nome: string
  cpf: string
  celular: string
  data_vencimento: string
  temResponsavel?: boolean
  responsavel_nome?: string
  responsavel_cpf?: string
  responsavel_celular?: string
}

export type ErrosAluno = Partial<Record<keyof DadosAluno, string>>

export function mascaraCPF(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3')
  if (v.length > 3) return v.replace(/(\d{3})(\d{0,3})/, '$1.$2')
  return v
}

export function mascaraCelular(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length > 6) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, '($1) $2')
  return v
}

/** Mensagem de erro do CPF, ou null se estiver certo. Dígitos verificadores incluídos. */
export function erroCPF(cpf: string): string | null {
  const nums = cpf.replace(/\D/g, '')
  if (!nums) return 'CPF é obrigatório (a cobrança precisa dele)'
  if (nums.length < 11) return 'CPF incompleto'
  if (!validarCPF(cpf)) return 'CPF inválido: confira os números'
  return null
}

export function validarDadosAluno(d: DadosAluno, opcoes: { nomeJaCadastrado?: boolean } = {}): ErrosAluno {
  const erros: ErrosAluno = {}
  if (d.nome.trim().length < 3) erros.nome = 'Nome deve ter no mínimo 3 caracteres'
  else if (opcoes.nomeJaCadastrado) erros.nome = 'Já existe um aluno com este nome'

  if (d.temResponsavel) {
    // Com responsável, o CPF do aluno deixa de ser obrigatório (mas, se preenchido, tem que estar certo)
    if (d.cpf.replace(/\D/g, '')) {
      const ec = erroCPF(d.cpf)
      if (ec) erros.cpf = ec
    }
    if ((d.responsavel_nome ?? '').trim().length < 3) erros.responsavel_nome = 'Informe o nome do responsável'
    const er = erroCPF(d.responsavel_cpf ?? '')
    if (er) erros.responsavel_cpf = er.replace('(a cobrança precisa dele)', '(a cobrança vai para ele)')
    if (d.responsavel_celular && !validarCelular(d.responsavel_celular)) erros.responsavel_celular = 'Celular inválido: use DDD + 9 dígitos'
  } else {
    const ec = erroCPF(d.cpf)
    if (ec) erros.cpf = ec
  }

  if (d.celular && !validarCelular(d.celular)) erros.celular = 'Celular inválido: use DDD + 9 dígitos'
  if (!d.data_vencimento) erros.data_vencimento = 'Informe o vencimento'
  return erros
}
