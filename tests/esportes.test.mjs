import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseValor, mascaraValor, estadoVazio, estadoDasMatriculas, matriculasParaGravar, idsParaApagar, idsEditaveis, extrasDe, totalMensal } from '../lib/esportes.ts'

const BT = { id: 'bt', nome: 'Beach Tênis' }
const PK = { id: 'pk', nome: 'Pickleball' }
const BB2 = 'u2'

test('parseValor aceita formatos brasileiros', () => {
  assert.equal(parseValor('150'), 150)
  assert.equal(parseValor('150,50'), 150.5)
  assert.equal(parseValor('1.250,00'), 1250)
  assert.equal(parseValor('231.00'), 231)
  assert.equal(parseValor(''), 0)
  assert.equal(parseValor('abc'), 0)
  assert.equal(parseValor(null), 0)
})
test('mascaraValor limita a 2 casas e uma vírgula', () => {
  assert.equal(mascaraValor('15a0'), '150')
  assert.equal(mascaraValor('150,5,99'), '150,59')
  assert.equal(mascaraValor('150,567'), '150,56')
})
test('esporte desligado não gera matrícula', () => {
  const e = estadoVazio(BT, BB2)
  e.clubinho = { ativo: true, id: null, valor: '100', combo: false }
  assert.deepEqual(matriculasParaGravar([e]), [])
})
test('Clubinho + Aula + Ranking no mesmo esporte', () => {
  const e = estadoVazio(BT, BB2)
  e.ativo = true
  e.clubinho = { ativo: true, id: null, valor: '100', combo: false }
  e.aulas = { ativo: true, lista: [{ id: null, tipo: 'Aula', professor: 'Ana', valor: '180' }] }
  e.ranking = { ativo: true, id: null, valor: '50' }
  const g = matriculasParaGravar([e])
  assert.deepEqual(g.map(m => m.tipo), ['Clubinho', 'Aula', 'Ranking'])
  assert.equal(totalMensal(g), 330)
  assert.equal(g[1].professor_nome, 'Ana')
  assert.ok(g.every(m => m.esporte_id === 'bt' && m.unidade_id === BB2))
})
test('combo só vale para Clubinho de Beach Tênis', () => {
  const bt = estadoVazio(BT, BB2); bt.ativo = true
  bt.clubinho = { ativo: true, id: null, valor: '100', combo: true }
  const pk = estadoVazio(PK, BB2); pk.ativo = true
  pk.clubinho = { ativo: true, id: null, valor: '100', combo: true }
  const g = matriculasParaGravar([bt, pk])
  assert.equal(g.find(m => m.esporte_id === 'bt').acesso_duas_unidades, true)
  assert.equal(g.find(m => m.esporte_id === 'pk').acesso_duas_unidades, false)
})
test('mais de 2 aulas por esporte são cortadas', () => {
  const e = estadoVazio(BT, BB2); e.ativo = true
  e.aulas = { ativo: true, lista: [1, 2, 3].map(i => ({ id: null, tipo: 'Aula', professor: 'P' + i, valor: '10' })) }
  assert.equal(matriculasParaGravar([e]).length, 2)
})
test('ida e volta: banco -> tela -> banco mantém ids e valores', () => {
  const banco = [
    { id: 'm1', tipo: 'Clubinho', valor: 150, professor_nome: null, esporte_id: 'bt', unidade_id: 'u1', acesso_duas_unidades: true },
    { id: 'm2', tipo: 'Aula', valor: 231, professor_nome: 'Ana', esporte_id: 'bt', unidade_id: 'u1', acesso_duas_unidades: false },
    { id: 'm3', tipo: 'Aula', valor: 100, professor_nome: 'Rui', esporte_id: 'pk', unidade_id: 'u2', acesso_duas_unidades: false },
  ]
  const estados = estadoDasMatriculas([BT, PK, { id: 'pd', nome: 'Padel' }], banco, BB2)
  assert.equal(estados[0].unidadeId, 'u1')
  assert.equal(estados[0].clubinho.combo, true)
  assert.equal(estados[2].ativo, false)
  const g = matriculasParaGravar(estados)
  assert.deepEqual(g.map(m => m.id), ['m1', 'm2', 'm3'])
  assert.equal(totalMensal(g), 481)
  assert.deepEqual(idsParaApagar(['m1', 'm2', 'm3'], g), [])
})
test('desligar um esporte apaga as matrículas dele', () => {
  const banco = [
    { id: 'm1', tipo: 'Clubinho', valor: 150, professor_nome: null, esporte_id: 'bt', unidade_id: 'u2', acesso_duas_unidades: false },
    { id: 'm3', tipo: 'Aula', valor: 100, professor_nome: 'Rui', esporte_id: 'pk', unidade_id: 'u2', acesso_duas_unidades: false },
  ]
  const estados = estadoDasMatriculas([BT, PK], banco, BB2)
  estados[1].ativo = false
  const g = matriculasParaGravar(estados)
  assert.deepEqual(idsParaApagar(['m1', 'm3'], g), ['m3'])
})

test('extrasDe separa as modalidades além das três fixas', () => {
  assert.deepEqual(extrasDe(['Clubinho', 'Aula', 'Ranking', 'Day Use']), ['Day Use'])
  assert.deepEqual(extrasDe(['Clubinho']), [])
})
test('modalidade extra ativa vira matrícula só com o valor', () => {
  const e = estadoVazio(BT, BB2, ['Day Use']); e.ativo = true
  e.extras[0] = { tipo: 'Day Use', ativo: true, id: null, valor: '40,50' }
  const g = matriculasParaGravar([e])
  assert.equal(g.length, 1)
  assert.deepEqual([g[0].tipo, g[0].valor, g[0].professor_nome], ['Day Use', 40.5, null])
})
test('ida e volta da modalidade extra', () => {
  const banco = [{ id: 'x1', tipo: 'Day Use', valor: 40, professor_nome: null, esporte_id: 'bt', unidade_id: 'u2', acesso_duas_unidades: false }]
  const estados = estadoDasMatriculas([BT], banco, BB2, ['Day Use'])
  assert.equal(estados[0].extras[0].ativo, true)
  assert.deepEqual(matriculasParaGravar(estados).map(m => m.id), ['x1'])
})
test('modalidade inativa: a matrícula do aluno não entra na lista de apagáveis', () => {
  const matriculas = [{ id: 'a', tipo: 'Clubinho' }, { id: 'b', tipo: 'Ranking' }, { id: 'c', tipo: 'Aula' }]
  assert.deepEqual(idsEditaveis(matriculas, ['Clubinho', 'Aula']), ['a', 'c'])
  // salvar sem mexer em nada não apaga o Ranking escondido
  const estados = [estadoVazio(BT, BB2)]
  estados[0].ativo = true
  estados[0].clubinho = { ativo: true, id: 'a', valor: '10', combo: false }
  estados[0].aulas = { ativo: true, lista: [{ id: 'c', tipo: 'Aula', professor: '', valor: '10' }] }
  const apagar = idsParaApagar(idsEditaveis(matriculas, ['Clubinho', 'Aula']), matriculasParaGravar(estados))
  assert.deepEqual(apagar, [])
})
