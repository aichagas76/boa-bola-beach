// Desliga as notificações do Asaas em todos os clientes que já existem (a comunicação é toda pelo n8n).
// Sem --gravar só conta quantos clientes têm notificação ligada; com --gravar desliga.
// A chave vem da variável ASAAS_API_KEY do seu terminal (nunca fica no código nem é mostrada).
//   PowerShell:  $env:ASAAS_API_KEY = "cole-a-chave-aqui"; node scripts/desligar-notificacoes-asaas.mjs [--gravar]

const chave = process.env.ASAAS_API_KEY
if (!chave) { console.error('Defina ASAAS_API_KEY no terminal antes de rodar.'); process.exit(1) }
const gravar = process.argv.includes('--gravar')
const base = 'https://api.asaas.com/v3'

async function chamar(caminho, metodo = 'GET', corpo) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { access_token: chave, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${j.errors?.[0]?.description ?? ''}`)
  return j
}

const clientes = []
for (let offset = 0; ; offset += 100) {
  const pag = await chamar(`/customers?limit=100&offset=${offset}`)
  clientes.push(...pag.data)
  if (!pag.hasMore) break
}
// Mesmo com notificationDisabled, o Asaas mantém as notificações padrão marcadas: confere cliente a cliente
async function notificacoesLigadas(id) {
  const l = await chamar(`/customers/${id}/notifications`)
  return l.data.filter(n => n.enabled || n.emailEnabledForCustomer || n.smsEnabledForCustomer || n.phoneCallEnabledForCustomer || n.whatsappEnabledForCustomer || n.emailEnabledForProvider || n.smsEnabledForProvider)
}
const ligados = []
for (const c of clientes) { const n = await notificacoesLigadas(c.id); if (!c.notificationDisabled || n.length) ligados.push({ ...c, ntf: n }) }
console.log(`Clientes no Asaas: ${clientes.length}. Com alguma notificação ligada: ${ligados.length}.`)

if (!gravar) {
  console.log('Nada foi alterado. Rode de novo com --gravar para desligar.')
} else {
  let ok = 0
  for (const c of ligados) {
    try {
      await chamar(`/customers/${c.id}`, 'PUT', { notificationDisabled: true })
      const todas = (await chamar(`/customers/${c.id}/notifications`)).data.map(n => ({ id: n.id, enabled: false, emailEnabledForProvider: false, smsEnabledForProvider: false, emailEnabledForCustomer: false, smsEnabledForCustomer: false, phoneCallEnabledForCustomer: false, whatsappEnabledForCustomer: false }))
      if (todas.length) await chamar('/notifications/batch', 'PUT', { customer: c.id, notifications: todas })
      ok++
    }
    catch (e) { console.error('Falhou:', c.id, e.message) }
  }
  console.log(`Desligadas em ${ok} de ${ligados.length} clientes.`)
}
