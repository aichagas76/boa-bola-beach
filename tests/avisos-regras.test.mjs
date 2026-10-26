import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sinalAviso, aplicarResultado, tipoValido, MAX_TENTATIVAS } from '../lib/avisos-regras.ts'

test('sem registro o n8n vê NAO (pode enviar)', () => assert.equal(sinalAviso(undefined), 'NAO'))
test('enviado nunca volta a ser enviado', () => assert.equal(sinalAviso({ resultado: 'SIM', tentativas: 1 }), 'SIM'))
test('falha com menos de 3 tentativas volta a ser tentada', () => {
  assert.equal(sinalAviso({ resultado: 'ERRO', tentativas: 1 }), 'NAO')
  assert.equal(sinalAviso({ resultado: 'ERRO', tentativas: MAX_TENTATIVAS - 1 }), 'NAO')
})
test('na 3ª falha desiste', () => assert.equal(sinalAviso({ resultado: 'ERRO', tentativas: MAX_TENTATIVAS }), 'ERRO'))
test('sequência de falhas avisa o dono só na desistência', () => {
  let r = aplicarResultado(undefined, 'ERRO')
  assert.equal(r.desistiu, false)
  r = aplicarResultado(r, 'ERRO')
  assert.equal(r.desistiu, false)
  r = aplicarResultado(r, 'ERRO')
  assert.equal(r.desistiu, true)
  assert.equal(r.tentativas, 3)
})
test('sucesso depois de falha fecha o aviso', () => {
  const r = aplicarResultado({ resultado: 'ERRO', tentativas: 2 }, 'SIM')
  assert.equal(r.resultado, 'SIM')
  assert.equal(sinalAviso(r), 'SIM')
})
test('resultado tardio de erro não desfaz um SIM', () => {
  const r = aplicarResultado({ resultado: 'SIM', tentativas: 1 }, 'ERRO')
  assert.equal(r.resultado, 'SIM')
  assert.equal(r.desistiu, false)
})
test('tipoValido', () => {
  assert.equal(tipoValido('3dias'), true)
  assert.equal(tipoValido('6diasAtraso'), true)
  assert.equal(tipoValido('x'), false)
  assert.equal(tipoValido(undefined), false)
})
