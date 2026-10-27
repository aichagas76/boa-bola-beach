import { test } from 'node:test'
import assert from 'node:assert/strict'
import { datasRecorrentes, validarRecorrencia, rotuloParcela } from '../lib/recorrencia.ts'

test('uma data por mês, no mesmo dia', () => {
  assert.deepEqual(datasRecorrentes('2026-10-10', 10, 3), ['2026-10-10', '2026-11-10', '2026-12-10'])
})
test('vira o ano', () => {
  assert.deepEqual(datasRecorrentes('2026-11-05', 5, 4), ['2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05'])
})
test('mês curto usa o último dia (e volta ao dia certo depois)', () => {
  assert.deepEqual(datasRecorrentes('2027-01-31', 31, 4), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
  assert.equal(datasRecorrentes('2028-01-30', 30, 2)[1], '2028-02-29') // ano bissexto
})
test('o dia da cobrança vale mesmo se o vencimento caiu em outro dia do mês', () => {
  assert.equal(datasRecorrentes('2026-10-30', 5, 1)[0], '2026-10-05')
})
test('validação de meses e dia', () => {
  assert.equal(validarRecorrencia(12, 10), null)
  assert.match(validarRecorrencia(1, 10), /Meses/)
  assert.match(validarRecorrencia(61, 10), /Meses/)
  assert.match(validarRecorrencia(12, 0), /dia/)
  assert.match(validarRecorrencia(12, 32), /dia/)
  assert.match(validarRecorrencia(12.5, 10), /Meses/)
})
test('rótulo da parcela', () => {
  assert.equal(rotuloParcela(3, 12), ' (3/12)')
})
