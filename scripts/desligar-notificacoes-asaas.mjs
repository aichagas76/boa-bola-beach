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
const ligados = clientes.filter(c => !c.notificationDisabled)
console.log(`Clientes no Asaas: ${clientes.length}. Com notificação ligada: ${ligados.length}.`)

if (!gravar) {
  console.log('Nada foi alterado. Rode de novo com --gravar para desligar.')
} else {
  let ok = 0
  for (const c of ligados) {
    try { await chamar(`/customers/${c.id}`, 'PUT', { notificationDisabled: true }); ok++ }
    catch (e) { console.error('Falhou:', c.id, e.message) }
  }
  console.log(`Desligadas em ${ok} de ${ligados.length} clientes.`)
}
