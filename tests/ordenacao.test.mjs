import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comparar, ordenar, proximaOrdem } from '../lib/ordenacao.ts'

test('texto ignora maiúsculas e acentos', () => {
  const r = ordenar(['Zélia', 'ana', 'Álvaro', 'Bruno'], x => x, 'asc')
  assert.deepEqual(r, ['Álvaro', 'ana', 'Bruno', 'Zélia'])
  assert.deepEqual(ordenar(['Zélia', 'ana', 'Álvaro', 'Bruno'], x => x, 'desc'), ['Zélia', 'Bruno', 'ana', 'Álvaro'])
})
test('números são comparados como números', () => {
  assert.deepEqual(ordenar([100, 9, 25], x => x, 'asc'), [9, 25, 100])
  assert.deepEqual(ordenar([100, 9, 25], x => x, 'desc'), [100, 25, 9])
})
test('textos com número dentro usam ordem natural (aluno 2 antes de aluno 10)', () => {
  assert.deepEqual(ordenar(['Aluno 10', 'Aluno 2'], x => x, 'asc'), ['Aluno 2', 'Aluno 10'])
})
test('datas em AAAA-MM-DD ordenam certo', () => {
  assert.deepEqual(ordenar(['2026-11-10', '2026-01-05', '2025-12-31'], x => x, 'asc'), ['2025-12-31', '2026-01-05', '2026-11-10'])
})
test('vazios ficam no fim nas duas direções', () => {
  const lista = [null, 'b', '', 'a', undefined]
  assert.deepEqual(ordenar(lista, x => x, 'asc').slice(0, 2), ['a', 'b'])
  assert.deepEqual(ordenar(lista, x => x, 'desc').slice(0, 2), ['b', 'a'])
  assert.equal(comparar(0, null, 'asc'), -1) // zero é valor, não vazio
})
test('empate mantém a ordem original', () => {
  const lista = [{ n: 'x', v: 1 }, { n: 'y', v: 1 }, { n: 'z', v: 0 }]
  assert.deepEqual(ordenar(lista, o => o.v, 'asc').map(o => o.n), ['z', 'x', 'y'])
})
test('clique no título alterna a direção; outra coluna começa crescente', () => {
  let o = { coluna: 'nome', direcao: 'asc' }
  o = proximaOrdem(o, 'nome'); assert.deepEqual(o, { coluna: 'nome', direcao: 'desc' })
  o = proximaOrdem(o, 'nome'); assert.deepEqual(o, { coluna: 'nome', direcao: 'asc' })
  o = proximaOrdem(o, 'valor'); assert.deepEqual(o, { coluna: 'valor', direcao: 'asc' })
})
