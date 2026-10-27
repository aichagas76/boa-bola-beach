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

import { mesesAtras } from '../lib/periodo.ts'
test('meses atrás: mesmo dia, ajustando mês curto e virada de ano', () => {
  assert.equal(mesesAtras('2026-10-26', 1), '2026-09-26')
  assert.equal(mesesAtras('2026-10-26', 3), '2026-07-26')
  assert.equal(mesesAtras('2026-10-26', 6), '2026-04-26')
  assert.equal(mesesAtras('2026-02-10', 3), '2025-11-10')
  assert.equal(mesesAtras('2026-05-31', 3), '2026-02-28')
  assert.equal(mesesAtras('2026-03-31', 1), '2026-02-28')
  assert.equal(mesesAtras('2028-05-31', 3), '2028-02-29')
})
