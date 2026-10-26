// Regras puras do webhook do Asaas (sem banco), para poderem ser testadas.

export type AcaoWebhook =
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'pagar'; valorPago: number; parcial: boolean }
  | { tipo: 'marcar'; status: 'Atrasado' | 'Pendente' | 'Cancelado' }
  | { tipo: 'estornar' }

type PagamentoLocal = { status: string | null; valor: number | string | null }

/** Diferença de até 1 centavo não conta como pagamento parcial. */
const TOLERANCIA = 0.009

/**
 * Decide o que fazer com o evento. Regra de ouro: um evento atrasado ou fora de ordem
 * (ex.: OVERDUE chegando depois de RECEIVED) nunca desfaz um pagamento já registrado.
 */
export function decidirWebhook(event: string, valorRecebido: number, pagamento: PagamentoLocal): AcaoWebhook {
  const status = pagamento.status ?? 'Pendente'
  const esperado = Number(pagamento.valor ?? 0)

  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED': {
      const valorPago = Number(valorRecebido)
      if (!(valorPago > 0)) return { tipo: 'ignorar', motivo: 'valor recebido inválido' }
      return { tipo: 'pagar', valorPago, parcial: esperado > 0 && valorPago + TOLERANCIA < esperado }
    }
    case 'PAYMENT_OVERDUE':
      if (status === 'Pago' || status === 'Cancelado') return { tipo: 'ignorar', motivo: `já está ${status}` }
      return { tipo: 'marcar', status: 'Atrasado' }
    case 'PAYMENT_RESTORED':
      if (status === 'Pago') return { tipo: 'ignorar', motivo: 'já está Pago' }
      return { tipo: 'marcar', status: 'Pendente' }
    case 'PAYMENT_REFUNDED':
      if (status !== 'Pago') return { tipo: 'ignorar', motivo: 'estorno de cobrança não paga' }
      return { tipo: 'estornar' }
    case 'PAYMENT_DELETED':
    case 'PAYMENT_CANCELED':
      if (status === 'Pago') return { tipo: 'ignorar', motivo: 'cobrança paga foi excluída no Asaas: conferir na mão' }
      return { tipo: 'marcar', status: 'Cancelado' }
    default:
      return { tipo: 'ignorar', motivo: `evento ${event} não tratado` }
  }
}

/** Soma 1 mês a 'AAAA-MM-DD' sem estourar o dia (31/01 -> 28/02, não 03/03). */
export function somarUmMes(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(y, m + 1, 0)).getUTCDate() // último dia do mês seguinte (m é base 1)
  return new Date(Date.UTC(y, m, Math.min(d, ultimoDia))).toISOString().slice(0, 10)
}
