export type NotificationType = 'payment_reminder' | 'payment_received' | 'payment_overdue' | 'new_enrollment'

export interface Notification {
  id: string
  aluno_id: string
  tipo: NotificationType
  titulo: string
  mensagem: string
  celular: string
  status: 'pendente' | 'enviado' | 'falha'
  tentativas: number
  proxima_tentativa: string | null
  enviado_em: string | null
  erro_mensagem: string | null
  data_criacao: string
}

export interface NotificationTemplate {
  tipo: NotificationType
  titulo: string
  corpo: (data: Record<string, any>) => string
}

export interface SendNotificationData {
  aluno_id: string
  celular: string
  tipo: NotificationType
  dados?: Record<string, any>
}
