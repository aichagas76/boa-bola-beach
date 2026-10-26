import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mascaraCPF, mascaraCelular, erroCPF, validarDadosAluno } from '../lib/aluno-validacao.ts'

test('máscara de CPF e celular', () => {
  assert.equal(mascaraCPF('12345678909'), '123.456.789-09')
  assert.equal(mascaraCPF('123456'), '123.456')
  assert.equal(mascaraCelular('19999998888'), '(19) 99999-8888')
})
test('CPF válido passa', () => assert.equal(erroCPF('529.982.247-25'), null))
test('CPF com dígito errado é recusado', () => {
  assert.match(erroCPF('529.982.247-26'), /inválido/)
  assert.match(erroCPF('123.456.789-00'), /inválido/)
})
test('CPF com todos os dígitos iguais é recusado', () => assert.match(erroCPF('111.111.111-11'), /inválido/))
test('CPF incompleto ou vazio', () => {
  assert.match(erroCPF('529.982'), /incompleto/)
  assert.match(erroCPF(''), /obrigatório/)
})
test('CPF repetido é permitido (só o nome não pode repetir)', () => assert.equal(erroCPF('529.982.247-25'), null))
test('nome repetido é recusado', () => {
  const base = { nome: 'Maria Souza', cpf: '529.982.247-25', celular: '', data_vencimento: '2026-11-10' }
  assert.match(validarDadosAluno(base, { nomeJaCadastrado: true }).nome, /Já existe um aluno/)
  assert.equal(validarDadosAluno(base).nome, undefined)
})
test('formulário completo e correto não tem erros', () => {
  const e = validarDadosAluno({ nome: 'Maria Souza', cpf: '529.982.247-25', celular: '(19) 99999-8888', data_vencimento: '2026-11-10' })
  assert.deepEqual(e, {})
})
test('formulário com problemas aponta cada campo', () => {
  const e = validarDadosAluno({ nome: 'Al', cpf: '123.456.789-00', celular: '(19) 9999', data_vencimento: '' })
  assert.deepEqual(Object.keys(e).sort(), ['celular', 'cpf', 'data_vencimento', 'nome'])
})
test('celular é opcional', () => {
  const e = validarDadosAluno({ nome: 'Maria', cpf: '529.982.247-25', celular: '', data_vencimento: '2026-11-10' })
  assert.deepEqual(e, {})
})

const base = { nome: 'Joãozinho Silva', cpf: '', celular: '', data_vencimento: '2026-11-10' }
test('sem responsável o CPF do aluno é obrigatório', () => {
  assert.match(validarDadosAluno(base).cpf, /obrigatório/)
})
test('com responsável o CPF do aluno não é obrigatório', () => {
  const e = validarDadosAluno({ ...base, temResponsavel: true, responsavel_nome: 'Maria Silva', responsavel_cpf: '529.982.247-25' })
  assert.deepEqual(e, {})
})
test('com responsável, CPF do aluno preenchido errado ainda é recusado', () => {
  const e = validarDadosAluno({ ...base, cpf: '123.456.789-00', temResponsavel: true, responsavel_nome: 'Maria Silva', responsavel_cpf: '529.982.247-25' })
  assert.match(e.cpf, /inválido/)
})
test('com responsável, nome e CPF do responsável são obrigatórios e validados', () => {
  const e = validarDadosAluno({ ...base, temResponsavel: true, responsavel_nome: '', responsavel_cpf: '' })
  assert.ok(e.responsavel_nome)
  assert.match(e.responsavel_cpf, /obrigatório/)
  const e2 = validarDadosAluno({ ...base, temResponsavel: true, responsavel_nome: 'Maria Silva', responsavel_cpf: '123.456.789-00' })
  assert.match(e2.responsavel_cpf, /inválido/)
})
test('celular do responsável é opcional, mas validado', () => {
  const ok = { ...base, temResponsavel: true, responsavel_nome: 'Maria Silva', responsavel_cpf: '529.982.247-25' }
  assert.equal(validarDadosAluno({ ...ok, responsavel_celular: '' }).responsavel_celular, undefined)
  assert.match(validarDadosAluno({ ...ok, responsavel_celular: '(19) 123' }).responsavel_celular, /inválido/)
})
