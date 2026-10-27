import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarNovoUsuario, validarAcessos } from '../lib/usuarios-regras.ts'

test('usuário correto não tem erros', () => {
  assert.deepEqual(validarNovoUsuario({ email: 'recepcao@boabola.com', senha: 'senha-forte-1', unidadeIds: ['u1'] }), [])
})
test('e-mail inválido, senha curta e sem unidade apontam cada erro', () => {
  const e = validarNovoUsuario({ email: 'sem-arroba', senha: '1234567', unidadeIds: [] })
  assert.equal(e.length, 3)
})
test('senha de 8 caracteres passa', () => {
  assert.deepEqual(validarNovoUsuario({ email: 'a@b.com', senha: '12345678', unidadeIds: ['u1'] }), [])
})
test('acessos: não aceita vazio nem unidade desconhecida', () => {
  assert.match(validarAcessos([], ['u1', 'u2']), /pelo menos uma/)
  assert.match(validarAcessos(['u9'], ['u1', 'u2']), /inválida/)
  assert.equal(validarAcessos(['u1', 'u2'], ['u1', 'u2']), null)
})

import { validarMudancaPerfil } from '../lib/usuarios-regras.ts'
test('perfil de gestora: dá para promover, não dá para se rebaixar nem ficar sem gestora', () => {
  const base = { userId: 'b', eu: 'a', gestoras: ['a', 'c'], virarGestora: false }
  assert.equal(validarMudancaPerfil({ ...base, virarGestora: true }), null)
  assert.equal(validarMudancaPerfil({ ...base, userId: 'c' }), null) // outra gestora é rebaixada, sobra a
  assert.match(validarMudancaPerfil({ ...base, userId: 'a' }), /própria/)
  assert.match(validarMudancaPerfil({ ...base, userId: 'c', eu: 'x', gestoras: ['c'] }), /pelo menos uma/)
})
