/**
 * Asaas API Client
 * Integração com plataforma de pagamentos Asaas
 */

interface CreateCustomerParams {
  name: string
  email: string
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
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED'
  value: number
  netValue?: number
  dueDate: string
  confirmationDate?: string
  paymentUrl: string
  customer: {
    id: string
    name: string
    email: string
  }
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
    data?: any
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
      email: params.email,
      phone: params.phone,
      cpfCnpj: params.cpf,
      notificationDisabled: false,
    })
  }

  async createPayment(params: CreatePaymentParams): Promise<AsaasPayment> {
    return this.request('/payments', 'POST', {
      customerId: params.customerId,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.reference,
      billingType: 'PIX', // PIX é mais rápido no Brasil
      reminders: {
        status: 'ENABLED',
      },
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
    const apiKey = process.env.ASAAS_API_KEY
    if (!apiKey) {
      throw new Error('ASAAS_API_KEY não configurada nas variáveis de ambiente')
    }
    clientInstance = new AsaasClient(apiKey)
  }
  return clientInstance
}
