import { test } from 'node:test'
import assert from 'node:assert/strict'
import { professoresDoEsporte } from '../lib/professores.ts'

const lista = [
  { id: '1', nome: 'Ana', esporteIds: ['bt'] },
  { id: '2', nome: 'Beto', esporteIds: ['padel', 'bt'] },
  { id: '3', nome: 'Caio', esporteIds: [] },
  { id: '4', nome: 'Duda', esporteIds: ['tenis'] },
]

test('só os professores do esporte; quem não tem esporte marcado aparece em todos', () => {
  assert.deepEqual(professoresDoEsporte(lista, 'bt').map(p => p.nome), ['Ana', 'Beto', 'Caio'])
  assert.deepEqual(professoresDoEsporte(lista, 'padel').map(p => p.nome), ['Beto', 'Caio'])
  assert.deepEqual(professoresDoEsporte(lista, 'pickle').map(p => p.nome), ['Caio'])
})

test('o professor já escolhido não some da lista ao editar', () => {
  assert.deepEqual(professoresDoEsporte(lista, 'padel', 'Duda').map(p => p.nome), ['Beto', 'Caio', 'Duda'])
})
