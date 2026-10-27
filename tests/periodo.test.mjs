import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ultimosDias } from '../lib/periodo.ts'

test('1 dia é só hoje', () => {
  assert.deepEqual(ultimosDias('2026-10-26', 1), { de: '2026-10-26', ate: '2026-10-26' })
})
test('3 e 7 dias contam hoje', () => {
  assert.deepEqual(ultimosDias('2026-10-26', 3), { de: '2026-10-24', ate: '2026-10-26' })
  assert.deepEqual(ultimosDias('2026-10-26', 7), { de: '2026-10-20', ate: '2026-10-26' })
})
test('atravessa o mês e o ano', () => {
  assert.deepEqual(ultimosDias('2026-11-02', 7), { de: '2026-10-27', ate: '2026-11-02' })
  assert.deepEqual(ultimosDias('2027-01-03', 7), { de: '2026-12-28', ate: '2027-01-03' })
  assert.deepEqual(ultimosDias('2028-03-02', 3), { de: '2028-02-29', ate: '2028-03-02' })
})
