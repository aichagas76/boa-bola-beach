import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pagador, clienteAsaasServe, paraBanco } from '../lib/responsavel.ts'

const aluno = { nome: 'Joãozinho', cpf: '111.444.777-35', celular: '(19) 90000-0001' }

test('sem responsável, quem paga é o aluno', () => {
  const p = pagador(aluno)
  assert.deepEqual([p.nome, p.cpf, p.celular, p.ehResponsavel], ['Joãozinho', '111.444.777-35', '(19) 90000-0001', false])
})
test('com responsável, a cobrança vai para ele', () => {
  const p = pagador({ ...aluno, responsavel_nome: ' Maria Silva ', responsavel_cpf: '529.982.247-25', responsavel_celular: '(19) 98888-7777' })
  assert.deepEqual([p.nome, p.cpf, p.celular, p.ehResponsavel], ['Maria Silva', '529.982.247-25', '(19) 98888-7777', true])
})
test('aluno sem CPF e com responsável: o CPF que vale é o do responsável', () => {
  const p = pagador({ nome: 'Criança', cpf: null, responsavel_nome: 'Pai', responsavel_cpf: '529.982.247-25' })
  assert.equal(p.cpf, '529.982.247-25')
})
test('responsável sem celular não herda o do aluno (avisos não vão para a criança)', () => {
  const p = pagador({ ...aluno, responsavel_nome: 'Pai', responsavel_cpf: '529.982.247-25' })
  assert.equal(p.celular, null)
})
test('cliente antigo do Asaas (sem CPF registrado) só serve para o aluno', () => {
  assert.equal(clienteAsaasServe(null, { cpf: '111.444.777-35', ehResponsavel: false }), true)
  assert.equal(clienteAsaasServe(null, { cpf: '529.982.247-25', ehResponsavel: true }), false)
})
test('cliente do Asaas serve se o CPF é o de quem paga agora', () => {
  assert.equal(clienteAsaasServe('52998224725', { cpf: '529.982.247-25', ehResponsavel: true }), true)
  assert.equal(clienteAsaasServe('11144477735', { cpf: '529.982.247-25', ehResponsavel: true }), false)
})
test('paraBanco: sem responsável zera os campos dele e tira o campo da tela', () => {
  const r = paraBanco({ nome: 'A', tem_responsavel: false, responsavel_nome: 'sobra', responsavel_cpf: 'x', responsavel_celular: 'y' })
  assert.equal('tem_responsavel' in r, false)
  assert.deepEqual([r.responsavel_nome, r.responsavel_cpf, r.responsavel_celular], [null, null, null])
})
test('paraBanco: com responsável grava os dados e vazio vira null', () => {
  const r = paraBanco({ nome: 'A', tem_responsavel: true, responsavel_nome: ' Maria ', responsavel_cpf: '529.982.247-25', responsavel_celular: '' })
  assert.deepEqual([r.responsavel_nome, r.responsavel_cpf, r.responsavel_celular], ['Maria', '529.982.247-25', null])
})
