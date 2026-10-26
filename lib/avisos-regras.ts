// Regras puras dos avisos de WhatsApp (sem banco), para poderem ser testadas.
// Cada aviso é controlado por cobrança + tipo (3dias, vencimento, 3diasAtraso, 6diasAtraso).

export const TIPOS_AVISO = ['3dias', 'vencimento', '3diasAtraso', '6diasAtraso'] as const
export type TipoAviso = (typeof TIPOS_AVISO)[number]

/** Depois de quantas falhas seguidas o sistema desiste do aviso (e avisa o dono). */
export const MAX_TENTATIVAS = 3

export type RegistroAviso = { resultado: 'SIM' | 'ERRO'; tentativas: number }

/**
 * O que o n8n enxerga: 'SIM' (já enviado) e 'ERRO' (desistiu) nunca mais são enviados;
 * 'NAO' (nunca tentou, ou falhou menos de 3 vezes) volta a ser tentado no próximo ciclo.
 */
export function sinalAviso(r: RegistroAviso | undefined): 'SIM' | 'ERRO' | 'NAO' {
  if (!r) return 'NAO'
  if (r.resultado === 'SIM') return 'SIM'
  return r.tentativas >= MAX_TENTATIVAS ? 'ERRO' : 'NAO'
}

/** Novo estado do registro depois que o n8n informa o resultado de uma tentativa. */
export function aplicarResultado(anterior: RegistroAviso | undefined, resultado: 'SIM' | 'ERRO') {
  if (anterior?.resultado === 'SIM') return { ...anterior, desistiu: false } // já enviado: não regride
  if (resultado === 'SIM') return { resultado: 'SIM' as const, tentativas: (anterior?.tentativas ?? 0) + 1, desistiu: false }
  const tentativas = (anterior?.tentativas ?? 0) + 1
  return { resultado: 'ERRO' as const, tentativas, desistiu: tentativas >= MAX_TENTATIVAS }
}

export function tipoValido(t: unknown): t is TipoAviso {
  return typeof t === 'string' && (TIPOS_AVISO as readonly string[]).includes(t)
}
