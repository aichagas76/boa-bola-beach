# Integração Asaas - Guia de Setup

## 1. Configuração Inicial

### API Key
- Acesse: https://app.asaas.com/settings/apikey
- Copie sua chave de API (começa com `aac_`)
- Adicione ao `.env.local`:
```env
ASAAS_API_KEY=aac_sua_chave_aqui
```

### Variáveis de Ambiente
```env
NEXT_PUBLIC_ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_API_KEY=seu_api_key
```

## 2. Setup do Webhook

### Configurar Notificações no Asaas
1. Acesse: https://app.asaas.com/settings/webhooks
2. Clique em **"Nova Notificação"**
3. Configure com os seguintes dados:

**URL do Webhook:**
```
https://seu-dominio.vercel.app/api/webhooks/asaas
```

Ou em desenvolvimento local (com ngrok):
```
https://seu-ngrok-url.ngrok.io/api/webhooks/asaas
```

**Eventos a ativar:**
- ✅ Pagamento recebido
- ✅ Pagamento confirmado
- ✅ Pagamento pendente
- ✅ Pagamento vencido
- ✅ Pagamento cancelado

**Autenticação:**
- Tipo: Nenhuma (Asaas enviará requisições POST diretas)

## 3. Usando em Desenvolvimento Local

### Usar ngrok para testar webhook
```bash
npm install -g ngrok
ngrok http 3000
```

Isso gera uma URL como: `https://xxxx-xxxx-xxxx.ngrok.io`

Use essa URL + `/api/webhooks/asaas` no Asaas.

## 4. Criando Cobranças

### Endpoint
```bash
POST /api/pagamentos/criar-asaas
```

### Payload
```json
{
  "alunoId": "uuid-do-aluno",
  "pagamentoId": "uuid-do-pagamento",
  "valor": 150.00,
  "dataVencimento": "2025-12-25",
  "descricao": "Mensalidade - Julho"
}
```

### Response
```json
{
  "success": true,
  "paymentId": "pay_xxxxx",
  "paymentUrl": "https://pix.asaas.com/pay/xxxxx",
  "customer": {
    "id": "cus_xxxxx",
    "name": "João Silva"
  }
}
```

## 5. Tipos de Pagamento

O sistema está configurado para **PIX** por padrão (mais rápido no Brasil).

Para mudar, edite `lib/asaas-client.ts`:
```typescript
billingType: 'PIX', // Opções: PIX, BOLETO, CREDIT_CARD, DEBIT_CARD, UNDEFINED
```

## 6. Status de Pagamento

| Asaas Status | App Status | Descrição |
|---|---|---|
| PENDING | pendente | Aguardando pagamento |
| RECEIVED | recebido | Pagamento confirmado |
| OVERDUE | vencido | Cobrança vencida |
| CANCELLED | cancelado | Cobrança cancelada |

## 7. Testes

### Testar Webhook Localmente
```bash
curl -X POST http://localhost:3000/api/webhooks/asaas \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_xxxxx",
      "status": "RECEIVED",
      "value": 150.00,
      "confirmationDate": "2025-01-01"
    }
  }'
```

### Simular Pagamento no Asaas
1. Crie uma cobrança via app
2. Copie o `paymentId`
3. Acesse Dashboard Asaas
4. Procure a cobrança e clique em "Simular Pagamento"

## 8. Banco de Dados

### Novas Colunas na Tabela `pagamentos`
```sql
asaas_payment_id VARCHAR(50)      -- ID da cobrança no Asaas
asaas_customer_id VARCHAR(50)     -- ID do cliente no Asaas
asaas_payment_url TEXT            -- Link de pagamento
payment_type VARCHAR(20)          -- 'manual' ou 'asaas'
sync_status VARCHAR(20)           -- 'pending' ou 'synced'
```

### Nova Tabela `asaas_customers`
```sql
id UUID PRIMARY KEY
asaas_id VARCHAR(50) UNIQUE
name VARCHAR(255)
email VARCHAR(255)
phone VARCHAR(20)
cpf VARCHAR(20)
created_at TIMESTAMP
updated_at TIMESTAMP
```

## 9. Fluxo Completo

1. ✅ Usuário clica "Gerar Link de Pagamento"
2. ✅ App chama `/api/pagamentos/criar-asaas`
3. ✅ API verifica/cria cliente no Asaas
4. ✅ API cria cobrança no Asaas
5. ✅ API retorna URL de pagamento
6. ✅ Usuário compartilha link com cliente
7. ✅ Cliente paga via PIX/Boleto/Cartão
8. ✅ Asaas envia webhook com confirmação
9. ✅ App atualiza status do pagamento
10. ✅ Dashboard atualiza em tempo real

## 10. Troubleshooting

### "ASAAS_API_KEY não configurada"
- Verifique `.env.local`
- Restart do servidor

### Webhook não chega
- Verifique URL do webhook no Asaas
- Verifique se é HTTPS em produção
- Use ngrok em desenvolvimento

### Erro "Erro ao criar cliente"
- Verifique CPF duplicado no Asaas
- CPF pode estar vinculado a outro cliente

### Pagamento não aparece como recebido
- Webhook pode ter falhado
- Verifique logs do servidor
- Verifique se status foi atualizado no banco

## 11. Referências

- [API Asaas](https://asaas.com/api)
- [Webhook Asaas](https://asaas.com/webhooks)
- [Tipos de Cobrança](https://asaas.com/billing-types)
