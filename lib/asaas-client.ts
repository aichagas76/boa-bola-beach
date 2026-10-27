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
    return this.request('/customers', 'POST', {
      name: params.name,
      email: params.email || undefined,
      mobilePhone: params.phone?.replace(/\D/g, '') || undefined,
      cpfCnpj: params.cpf?.replace(/\D/g, '') || undefined,
      notificationDisabled: false,
    })
  }

  async createPayment(params: CreatePaymentParams): Promise<AsaasPayment> {
    return this.request('/payments', 'POST', {
      customer: params.customerId,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.reference,
      billingType: 'UNDEFINED', // cliente escolhe PIX, boleto ou cartão na página
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
