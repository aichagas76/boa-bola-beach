/**
 * Asaas API Client
 * Integração com plataforma de pagamentos Asaas
 */

interface CreateCustomerParams {
  name: string
  email?: string
  phone?: string
  cpf?: string
}

interface CreatePaymentParams {
  customerId: string
  value: number
  dueDate: string
  description: string
  reference?: string
}

interface AsaasPayment {
  id: string
  status: string
  value: number
  netValue?: number
  dueDate: string
  confirmationDate?: string
  invoiceUrl: string
  customer: string
}

export class AsaasClient {
  private apiKey: string
  private baseUrl = 'https://api.asaas.com/v3'

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ASAAS_API_KEY não configurada')
    }
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
      },
    }

    if (data) {
      options.body = JSON.stringify(data)
    }

    console.log(`[Asaas] ${method} ${endpoint}`)
    const response = await fetch(url, options)

    if (!response.ok) {
      const error = await response.json()
      console.error(`[Asaas Error] Status: ${response.status}`, error)
      throw new Error(`Asaas Error: ${error.errors?.[0]?.detail || error.message || JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log(`[Asaas Success] ${endpoint}`, result)
    return result
  }

  async createCustomer(params: CreateCustomerParams) {
    const cliente = await this.request('/customers', 'POST', {
      name: params.name,
      email: params.email || undefined,
      mobilePhone: params.phone?.replace(/\D/g, '') || undefined,
      cpfCnpj: params.cpf?.replace(/\D/g, '') || undefined,
      // Nenhuma notificação do Asaas (e-mail, SMS, WhatsApp): toda a comunicação com o cliente é feita pelo n8n
      notificationDisabled: true,
    })
    // O Asaas cria as notificações padrão (e-mail, SMS, WhatsApp...) já ligadas; zera todas
    await this.zerarNotificacoes((cliente as { id: string }).id)
    return cliente
  }

  /** Desliga todas as notificações do cliente (e-mail, SMS, voz e WhatsApp, para o cliente e para você). */
  async zerarNotificacoes(customerId: string) {
    const lista = (await this.request(`/customers/${customerId}/notifications`)) as { data?: { id: string }[] }
    const notifications = (lista.data ?? []).map(n => ({
      id: n.id,
      enabled: false,
      emailEnabledForProvider: false,
      smsEnabledForProvider: false,
      emailEnabledForCustomer: false,
      smsEnabledForCustomer: false,
      phoneCallEnabledForCustomer: false,
      whatsappEnabledForCustomer: false,
    }))
    if (notifications.length === 0) return
    await this.request('/notifications/batch', 'PUT', { customer: customerId, notifications })
  }

  /** Desliga as notificações de um cliente que já existe no Asaas. */
  async disableCustomerNotifications(customerId: string) {
    await this.request(`/customers/${customerId}`, 'PUT', { notificationDisabled: true })
    await this.zerarNotificacoes(customerId)
  }

  async createPayment(params: CreatePaymentParams): Promise<AsaasPayment> {
    return this.request('/payments', 'POST', {
      customer: params.customerId,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.reference,
      billingType: 'PIX', // o link abre direto no PIX (QR code e copia e cola)
    })
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    return this.request(`/payments/${paymentId}`)
  }

  async listPayments(customerId?: string) {
    let endpoint = '/payments'
    if (customerId) {
      endpoint += `?customer=${customerId}`
    }
    return this.request(endpoint)
  }

  async deletePayment(paymentId: string) {
    return this.request(`/payments/${paymentId}`, 'DELETE')
  }

  async getCustomer(customerId: string) {
    return this.request(`/customers/${customerId}`)
  }

  async listCustomers() {
    return this.request('/customers')
  }
}

// Export singleton instance
let clientInstance: AsaasClient | null = null

export function getAsaasClient(): AsaasClient {
  if (!clientInstance) {
    let apiKey = process.env.ASAAS_API_KEY?.trim()
    if (!apiKey) {
      throw new Error('ASAAS_API_KEY não configurada nas variáveis de ambiente')
    }
    // Chaves Asaas começam com "$aact_"; o "$" costuma se perder em .env/cópia
    if (apiKey.startsWith('aact_')) apiKey = `$${apiKey}`
    clientInstance = new AsaasClient(apiKey)
  }
  return clientInstance
}
