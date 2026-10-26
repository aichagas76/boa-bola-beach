import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comissaoPorProfessor, faturamentoPorEsporte, competenciaDe, normaliza, paraCsv } from '../lib/relatorios-gerenciais.ts'

const HOJE = '2026-10-26'
const prof = { id: 'p1', nome: 'Jeferson', comissao_percentual: 40 }
const aluno = (o = {}) => ({ id: 'a1', nome: 'Aluno 1', status: 'Ativo', data_cadastro: '2026-01-10', data_inativacao: null, data_vencimento: '2026-11-10', ...o })
const mat = (o = {}) => ({ aluno_id: 'a1', tipo: 'Aula', valor: 200, professor_id: null, professor_nome: 'Jeferson', esporte_nome: 'Beach Tênis', unidade_id: 'u2', acesso_duas_unidades: false, ...o })
const base = (o = {}) => ({ mes: '2026-10', hoje: HOJE, professores: [prof], alunos: [aluno()], matriculas: [mat()], entradas: [], unidadeId: 'u2', ...o })

test('competência é o mês do vencimento, não o do pagamento', () => {
  assert.equal(competenciaDe({ data_vencimento: '2026-09-28', data: '2026-10-02' }), '2026-09')
  assert.equal(competenciaDe({ data_vencimento: null, data: '2026-10-02' }), '2026-10')
})
test('nomes são comparados sem acento, caixa e espaços extras', () => {
  assert.equal(normaliza('  JeFerson  '), 'jeferson')
  assert.equal(normaliza('José  da Conceição'), 'jose da conceicao')
})

test('aluno que pagou: comissão total = devida', () => {
  const r = comissaoPorProfessor(base({ entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-10' }] }))
  const l = r.linhas[0]
  assert.deepEqual([l.professor, l.percentual, l.base, l.comissaoTotal, l.descontado, l.devido], ['Jeferson', 40, 200, 80, 0, 80])
  assert.equal(l.detalhe[0].situacao, 'Pago')
})
test('aluno inadimplente (vencimento do mês já passou) é descontado', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })] }))
  const l = r.linhas[0]
  assert.deepEqual([l.comissaoTotal, l.descontado, l.devido], [80, 80, 0])
  assert.equal(l.detalhe[0].situacao, 'Inadimplente')
})
test('aluno com vencimento ainda por chegar não é descontado', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-30' })] }))
  assert.deepEqual([r.linhas[0].descontado, r.linhas[0].devido, r.linhas[0].detalhe[0].situacao], [0, 80, 'A vencer'])
})
test('pagamento parcial desconta só a parte que falta', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })], entradas: [{ aluno_ref_id: 'a1', valor: 50, competencia: '2026-10' }] }))
  assert.deepEqual([r.linhas[0].comissaoTotal, r.linhas[0].descontado, r.linhas[0].devido], [80, 60, 20]) // faltam 75% do valor
})
test('pagamento da competência anterior não vale para o mês escolhido', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })], entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-09' }] }))
  assert.equal(r.linhas[0].descontado, 80)
})
test('o que o aluno paga fora das aulas entra na conta de quitação', () => {
  // Aula 200 (professor) + Clubinho 100 (sem professor): pagou só 100 de 300
  const r = comissaoPorProfessor(base({
    alunos: [aluno({ data_vencimento: '2026-10-10' })],
    matriculas: [mat(), mat({ tipo: 'Clubinho', valor: 100, professor_nome: null })],
    entradas: [{ aluno_ref_id: 'a1', valor: 100, competencia: '2026-10' }],
  }))
  assert.equal(r.linhas[0].comissaoTotal, 80) // só a aula gera comissão
  assert.equal(r.linhas[0].descontado, 53.33) // 80 × (2/3 em falta)
})
test('professor sem percentual aparece, avisando, com comissão zero', () => {
  const r = comissaoPorProfessor(base({ professores: [{ id: 'p1', nome: 'Jeferson', comissao_percentual: null }] }))
  assert.deepEqual([r.linhas[0].semPercentual, r.linhas[0].comissaoTotal], [true, 0])
})
test('professor não cadastrado (só o nome na matrícula) aparece sem percentual', () => {
  const r = comissaoPorProfessor(base({ professores: [], matriculas: [mat({ professor_nome: 'Fulano' })] }))
  assert.deepEqual([r.linhas[0].professor, r.linhas[0].semPercentual], ['Fulano', true])
})
test('aluno inativo, cadastrado depois do mês ou sem professor não entram', () => {
  const alunos = [
    aluno({ id: 'a1', status: 'Inativo', data_inativacao: '2026-08-01' }),
    aluno({ id: 'a2', data_cadastro: '2026-11-05' }),
    aluno({ id: 'a3' }),
  ]
  const matriculas = [mat({ aluno_id: 'a1' }), mat({ aluno_id: 'a2' }), mat({ aluno_id: 'a3', professor_nome: null })]
  assert.deepEqual(comissaoPorProfessor(base({ alunos, matriculas })).linhas, [])
})
test('aluno inativado dentro do mês ainda conta nesse mês', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ status: 'Inativo', data_inativacao: '2026-10-15' })] }))
  assert.equal(r.linhas.length, 1)
})
test('filtros de professor e de esporte', () => {
  const professores = [prof, { id: 'p2', nome: 'Ana', comissao_percentual: 30 }]
  const alunos = [aluno({ id: 'a1' }), aluno({ id: 'a2', nome: 'Aluno 2' })]
  const matriculas = [mat(), mat({ aluno_id: 'a2', professor_nome: 'Ana', esporte_nome: 'Padel', valor: 100 })]
  assert.deepEqual(comissaoPorProfessor(base({ professores, alunos, matriculas })).linhas.map(l => l.professor), ['Ana', 'Jeferson'])
  assert.deepEqual(comissaoPorProfessor(base({ professores, alunos, matriculas, filtroProfessorId: 'p2' })).linhas.map(l => l.professor), ['Ana'])
  assert.deepEqual(comissaoPorProfessor(base({ professores, alunos, matriculas, filtroEsporte: 'Beach Tênis' })).linhas.map(l => l.professor), ['Jeferson'])
})
test('totais somam os professores', () => {
  const professores = [prof, { id: 'p2', nome: 'Ana', comissao_percentual: 50 }]
  const alunos = [aluno({ id: 'a1' }), aluno({ id: 'a2', data_vencimento: '2026-10-10' })]
  const matriculas = [mat(), mat({ aluno_id: 'a2', professor_nome: 'Ana', valor: 100 })]
  const entradas = [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-10' }] // a1 pagou; a2 não
  const r = comissaoPorProfessor(base({ professores, alunos, matriculas, entradas }))
  assert.deepEqual([r.totais.comissaoTotal, r.totais.descontado, r.totais.devido], [130, 50, 80])
})
test('combo: na unidade conta só a metade', () => {
  const r = comissaoPorProfessor(base({ matriculas: [mat({ acesso_duas_unidades: true })] }))
  assert.equal(r.linhas[0].base, 100)
})

const m = (o = {}) => ({ tipo: 'Entrada', status: 'Recebido', valor: 100, data: '2026-10-05', data_pagamento: null, esporte_nome: 'Beach Tênis', ...o })
const P = { inicio: '2026-10-01', fim: '2026-10-31' }

test('faturamento e lucro por esporte', () => {
  const r = faturamentoPorEsporte({
    ...P, ratear: false,
    movs: [
      m({ valor: 1000 }), m({ valor: 600, esporte_nome: 'Padel' }), m({ valor: 50, esporte_nome: null }),
      m({ tipo: 'Saída', status: 'Pago', valor: 300 }),
      m({ tipo: 'Saída', status: 'Pago', valor: 200, esporte_nome: null }), // geral
      m({ valor: 999, status: 'Não recebido' }), m({ valor: 77, data: '2026-09-30' }),
    ],
  })
  assert.deepEqual(r.linhas.map(l => [l.esporte, l.faturamento, l.despesas, l.resultado]), [['Beach Tênis', 1000, 300, 700], ['Padel', 600, 0, 600], ['Sem esporte', 50, 0, 50]])
  assert.equal(r.despesasGerais, 200)
  assert.deepEqual(r.totais, { faturamento: 1650, despesas: 500, lucro: 1150 })
})
test('rateio divide as despesas gerais pelo faturamento e o lucro total não muda', () => {
  const movs = [m({ valor: 750 }), m({ valor: 250, esporte_nome: 'Padel' }), m({ tipo: 'Saída', status: 'Pago', valor: 100, esporte_nome: null })]
  const a = faturamentoPorEsporte({ ...P, movs, ratear: false })
  const b = faturamentoPorEsporte({ ...P, movs, ratear: true })
  assert.deepEqual(b.linhas.map(l => l.rateio), [75, 25])
  assert.deepEqual(b.linhas.map(l => l.lucro), [675, 225])
  assert.equal(a.totais.lucro, b.totais.lucro)
  assert.equal(b.linhas.reduce((s, l) => s + l.lucro, 0), b.totais.lucro)
})
test('o mês vale pela data do pagamento', () => {
  const r = faturamentoPorEsporte({ ...P, ratear: false, movs: [m({ data: '2026-09-28', data_pagamento: '2026-10-02', valor: 80 })] })
  assert.equal(r.totais.faturamento, 80)
})

test('CSV usa ; e vírgula decimal e protege textos', () => {
  const csv = paraCsv([['Nome', 'Valor'], ['Silva; "Jr"', 80.5]])
  assert.equal(csv, '﻿Nome;Valor\r\n"Silva; ""Jr""";80,50')
})
