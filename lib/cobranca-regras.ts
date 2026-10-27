// Regras puras do ciclo de cobrança (sem banco), para poderem ser testadas.
// Datas sempre no formato 'AAAA-MM-DD' (fuso de São Paulo).

/** Depois de quantos dias de atraso o sistema para de gerar cobrança sozinho (aluno provavelmente parou). */
export const MAX_DIAS_ATRASO_AUTOMATICO = 90

export function diasEntre(deISO: string, ateISO: string) {
  const [y1, m1, d1] = deISO.split('-').map(Number)
  const [y2, m2, d2] = ateISO.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export type SituacaoVencimento = 'futuro' | 'atrasado' | 'atrasado_demais' | 'fora_da_janela'

/** Onde o vencimento do aluno cai em relação a hoje e à janela de antecedência. */
export function situacaoVencimento(vencimento: string, hoje: string, limite: string): SituacaoVencimento {
  if (vencimento > limite) return 'fora_da_janela'
  if (vencimento >= hoje) return 'futuro'
  return diasEntre(vencimento, hoje) > MAX_DIAS_ATRASO_AUTOMATICO ? 'atrasado_demais' : 'atrasado'
}

/** O Asaas não aceita cobrança com vencimento no passado: cobra a partir de hoje, mas o sistema guarda o vencimento original. */
export function vencimentoNoAsaas(vencimento: string, hoje: string) {
  return vencimento < hoje ? hoje : vencimento
}

type PagamentoResumo = { data_vencimento: string | null; status: string | null }

/**
 * Já existe cobrança que cobre este vencimento? Vale a do mesmo vencimento (paga ou não)
 * e, para vencimento atrasado, qualquer cobrança ainda em aberto (evita cobrar 2x o mesmo aluno).
 */
export function jaTemCobranca(pagamentos: PagamentoResumo[], vencimento: string, atrasado: boolean) {
  return pagamentos.some(p => {
    if (p.data_vencimento === vencimento) return true
    return atrasado && p.status !== 'Pago' && p.status !== 'Cancelado'
  })
}

/** Data de hoje (+ dias) no fuso de São Paulo, 'AAAA-MM-DD'. O servidor da Vercel roda em UTC. */
export function dataSaoPaulo(somarDias = 0) {
  return new Date(Date.now() + somarDias * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

type DecisaoAcesso = { ok: true } | { ok: false; status: number; erro: string }

/** O login pode mexer neste aluno? Só se estiver logado e tiver acesso à unidade do aluno. */
export function decidirAcessoAluno(p: { logado: boolean; alunoExiste: boolean; alunoUnidade: string | null | undefined; unidadesDoLogin: string[] }): DecisaoAcesso {
  if (!p.logado) return { ok: false, status: 401, erro: 'Não autenticado' }
  if (!p.alunoExiste) return { ok: false, status: 404, erro: 'Aluno não encontrado' }
  if (!p.alunoUnidade || !p.unidadesDoLogin.includes(p.alunoUnidade)) {
    return { ok: false, status: 403, erro: 'Seu login não tem acesso à unidade deste aluno' }
  }
  return { ok: true }
}

/** O valor de uma cobrança nova nunca pode passar do que o aluno deve (mensalidades + produtos em aberto). Mensagem de erro, ou null. */
export function validarValorCobranca(valor: unknown, devido: number): string | null {
  const v = Number(valor)
  if (!Number.isFinite(v) || v <= 0) return 'Valor inválido'
  if (!(devido > 0)) return 'Este aluno não tem valor a cobrar'
  if (v > Math.round(devido * 100) / 100 + 0.005) {
    return `Valor acima do que o aluno deve (R$ ${devido.toFixed(2).replace('.', ',')})`
  }
  return null
}

/** Integração com o Asaas (cobranças, clientes e avisos de pagamento): só liga com ASAAS_ATIVO=sim na Vercel; qualquer outra coisa = desligada. */
export const asaasLigado = (valor: string | undefined) => (valor ?? '').trim().toLowerCase() === 'sim'
