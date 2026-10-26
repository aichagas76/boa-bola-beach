import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirWebhook, somarUmMes } from '../lib/webhook-regras.ts'

const pend = { status: 'Pendente', valor: 150 }
const pago = { status: 'Pago', valor: 150 }

test('pagamento total é baixa completa', () => {
  assert.deepEqual(decidirWebhook('PAYMENT_RECEIVED', 150, pend), { tipo: 'pagar', valorPago: 150, parcial: false })
  assert.deepEqual(decidirWebhook('PAYMENT_CONFIRMED', 150, pend), { tipo: 'pagar', valorPago: 150, parcial: false })
})
test('valor menor que o da cobrança é parcial e não conta como pago', () => {
  assert.equal(decidirWebhook('PAYMENT_RECEIVED', 100, pend).parcial, true)
})
test('diferença de 1 centavo não é parcial; valor maior também não', () => {
  assert.equal(decidirWebhook('PAYMENT_RECEIVED', 149.995, pend).parcial, false)
  assert.equal(decidirWebhook('PAYMENT_RECEIVED', 160, pend).parcial, false)
})
test('valor zero ou inválido é ignorado', () => {
  assert.equal(decidirWebhook('PAYMENT_RECEIVED', 0, pend).tipo, 'ignorar')
  assert.equal(decidirWebhook('PAYMENT_RECEIVED', NaN, pend).tipo, 'ignorar')
})
test('OVERDUE atrasado depois do pagamento não desfaz o Pago', () => {
  assert.equal(decidirWebhook('PAYMENT_OVERDUE', 150, pago).tipo, 'ignorar')
  assert.deepEqual(decidirWebhook('PAYMENT_OVERDUE', 150, pend), { tipo: 'marcar', status: 'Atrasado' })
})
test('estorno só vale para cobrança paga', () => {
  assert.deepEqual(decidirWebhook('PAYMENT_REFUNDED', 150, pago), { tipo: 'estornar' })
  assert.equal(decidirWebhook('PAYMENT_REFUNDED', 150, pend).tipo, 'ignorar')
})
test('cobrança excluída vira Cancelado, mas paga é preservada', () => {
  assert.deepEqual(decidirWebhook('PAYMENT_DELETED', 150, pend), { tipo: 'marcar', status: 'Cancelado' })
  assert.equal(decidirWebhook('PAYMENT_DELETED', 150, pago).tipo, 'ignorar')
})
test('restaurada volta a Pendente; paga não muda', () => {
  assert.deepEqual(decidirWebhook('PAYMENT_RESTORED', 150, { status: 'Cancelado', valor: 150 }), { tipo: 'marcar', status: 'Pendente' })
  assert.equal(decidirWebhook('PAYMENT_RESTORED', 150, pago).tipo, 'ignorar')
})
test('evento desconhecido é ignorado', () => {
  assert.equal(decidirWebhook('PAYMENT_CREATED', 150, pend).tipo, 'ignorar')
})
test('somarUmMes respeita o fim do mês', () => {
  assert.equal(somarUmMes('2026-10-10'), '2026-11-10')
  assert.equal(somarUmMes('2026-01-31'), '2026-02-28')
  assert.equal(somarUmMes('2028-01-31'), '2028-02-29')
  assert.equal(somarUmMes('2026-12-15'), '2027-01-15')
})
