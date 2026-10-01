import { NotificationTemplate } from './types'

export const notificationTemplates: Record<string, NotificationTemplate> = {
  payment_reminder: {
    tipo: 'payment_reminder',
    titulo: 'Lembrete de Pagamento',
    corpo: (data) => `
Olá ${data.nome}! 👋

Sua mensalidade vence em ${data.dias} dias.

📅 Vencimento: ${data.data_vencimento}
💰 Valor: R$ ${data.valor}

Clique aqui para pagar: ${data.link_pagamento || 'acesse o app'}

Dúvidas? Responda essa mensagem!
`.trim(),
  },

  payment_received: {
    tipo: 'payment_received',
    titulo: 'Pagamento Recebido',
    corpo: (data) => `
🎉 Pagamento recebido com sucesso!

Olá ${data.nome},

Recebemos seu pagamento de R$ ${data.valor} em ${data.data_pagamento}.

Sua próxima mensalidade vence em ${data.proxima_data_vencimento}.

Obrigado! 💚
`.trim(),
  },

  payment_overdue: {
    tipo: 'payment_overdue',
    titulo: 'Pagamento em Atraso',
    corpo: (data) => `
⚠️ PAGAMENTO EM ATRASO

Olá ${data.nome},

Seu pagamento está ${data.dias_atrasado} dias em atraso.

💰 Valor devido: R$ ${data.valor}
📅 Vencimento: ${data.data_vencimento}

Regularize sua situação: ${data.link_pagamento || 'acesse o app'}

Precisamos resolver isso! Entre em contato.
`.trim(),
  },

  new_enrollment: {
    tipo: 'new_enrollment',
    titulo: 'Bem-vindo!',
    corpo: (data) => `
🎉 Bem-vindo ao Boa Bola Beach!

Olá ${data.nome},

Sua inscrição foi confirmada com sucesso!

📋 Modalidades: ${data.modalidades}
💰 Mensalidade: R$ ${data.valor}
📅 Primeira cobrança: ${data.primeira_cobranca}

Estamos animados em tê-lo conosco! 💚

Qualquer dúvida, nos procure.
`.trim(),
  },
}

export function getTemplate(tipo: string) {
  return notificationTemplates[tipo]
}
