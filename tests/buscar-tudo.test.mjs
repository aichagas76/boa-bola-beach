import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarTudo } from '../lib/buscar-tudo.ts'

// Simula o banco: devolve no máximo 1000 linhas por pedido, como o Supabase
const banco = total => (de, ate) => {
  const limite = Math.min(ate, de + 999, total - 1)
  const linhas = de > limite ? [] : Array.from({ length: limite - de + 1 }, (_, i) => de + i)
  return Promise.resolve({ data: linhas, error: null })
}

test('busca todas as linhas, passando de 1000', async () => {
  const r = await buscarTudo(banco(2347))
  assert.equal(r.data.length, 2347)
  assert.equal(r.data[0], 0)
  assert.equal(r.data.at(-1), 2346)
  assert.equal(new Set(r.data).size, 2347) // sem repetir nenhuma
})
test('exatamente 1000 ou menos', async () => {
  assert.equal((await buscarTudo(banco(1000))).data.length, 1000)
  assert.equal((await buscarTudo(banco(37))).data.length, 37)
  assert.equal((await buscarTudo(banco(0))).data.length, 0)
})
test('erro em qualquer página devolve o erro', async () => {
  let chamadas = 0
  const r = await buscarTudo(() => Promise.resolve(++chamadas === 2 ? { data: null, error: { message: 'falhou' } } : { data: Array(1000).fill(1), error: null }))
  assert.equal(r.error.message, 'falhou')
  assert.equal(r.data, null)
})
