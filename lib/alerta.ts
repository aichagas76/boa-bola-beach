// Aviso ativo no WhatsApp (fluxo do n8n). Sem as variáveis, o aviso fica desligado e o erro só aparece nos logs da Vercel.
export type DadosAlerta = { origem: string; mensagem: string; detalhe?: string | null; teste?: boolean }

export function alertaConfigurado(): boolean {
  return !!process.env.WHATSAPP_ALERTA_URL && !!process.env.WHATSAPP_ALERTA_TELEFONE
}

export function montarPayloadAlerta(d: DadosAlerta, quando = new Date()) {
  return {
    telefone: process.env.WHATSAPP_ALERTA_TELEFONE ?? '',
    teste: !!d.teste,
    origem: d.origem,
    mensagem: d.mensagem.slice(0, 300),
    detalhe: (d.detalhe ?? '').slice(0, 300),
    quando: quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }),
  }
}

// Devolve true se o fluxo respondeu. Nunca lança erro: o aviso não pode piorar a falha original.
export async function enviarAlerta(d: DadosAlerta): Promise<boolean> {
  if (!alertaConfigurado()) return false
  try {
    const r = await fetch(process.env.WHATSAPP_ALERTA_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarPayloadAlerta(d)),
      signal: AbortSignal.timeout(5000),
    })
    return r.ok
  } catch {
    return false
  }
}
