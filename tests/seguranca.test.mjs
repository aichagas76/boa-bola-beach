import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bearerValido, textoIgual } from '../lib/seguranca.ts'

test('bearer correto é aceito', () => assert.equal(bearerValido('Bearer abc', 'abc'), true))
test('bearer errado ou ausente é negado', () => {
  assert.equal(bearerValido('Bearer xyz', 'abc'), false)
  assert.equal(bearerValido(null, 'abc'), false)
  assert.equal(bearerValido('abc', 'abc'), false)
})
test('sem segredo configurado nega sempre', () => {
  assert.equal(bearerValido('Bearer ', ''), false)
  assert.equal(bearerValido('Bearer undefined', undefined), false)
})
test('textoIgual', () => {
  assert.equal(textoIgual('a', 'a'), true)
  assert.equal(textoIgual('a', 'ab'), false)
  assert.equal(textoIgual(null, 'a'), false)
})
