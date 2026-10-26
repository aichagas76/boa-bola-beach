// Regras do "Responsável": quando o aluno tem responsável, a cobrança e os avisos vão para ele.

export type DadosPagador = {
  nome: string
  cpf: string | null
  celular: string | null
}

type AlunoComResponsavel = {
  nome: string
  cpf?: string | null
  celular?: string | null
  responsavel_nome?: string | null
  responsavel_cpf?: string | null
  responsavel_celular?: string | null
}

const digitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

/** Quem paga: o responsável (se houver nome dele cadastrado) ou o próprio aluno. */
export function pagador(a: AlunoComResponsavel): DadosPagador & { ehResponsavel: boolean } {
  const temResp = !!a.responsavel_nome?.trim()
  return temResp
    ? { nome: a.responsavel_nome!.trim(), cpf: a.responsavel_cpf || null, celular: a.responsavel_celular || null, ehResponsavel: true }
    : { nome: a.nome, cpf: a.cpf || null, celular: a.celular || null, ehResponsavel: false }
}

/**
 * O cliente já criado no Asaas ainda serve para quem paga agora?
 * Cliente antigo (sem CPF registrado) só serve se quem paga é o próprio aluno.
 */
export function clienteAsaasServe(docDoCliente: string | null | undefined, p: { cpf: string | null; ehResponsavel: boolean }) {
  if (!docDoCliente) return !p.ehResponsavel
  return digitos(docDoCliente) === digitos(p.cpf)
}

export type FormComResponsavel = {
  tem_responsavel: boolean
  responsavel_nome: string
  responsavel_cpf: string
  responsavel_celular: string
}

/** Tira o campo só-da-tela (tem_responsavel) e grava vazio como NULL; sem responsável, apaga os dados dele. */
export function paraBanco<T extends FormComResponsavel>(form: T) {
  const { tem_responsavel, ...resto } = form
  return {
    ...resto,
    responsavel_nome: tem_responsavel ? form.responsavel_nome.trim() || null : null,
    responsavel_cpf: tem_responsavel ? form.responsavel_cpf || null : null,
    responsavel_celular: tem_responsavel ? form.responsavel_celular || null : null,
  }
}
