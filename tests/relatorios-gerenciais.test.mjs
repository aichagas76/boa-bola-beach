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

test('aluno que pagou: a comissão toda entra no pagamento', () => {
  const r = comissaoPorProfessor(base({ entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-10' }] }))
  const l = r.linhas[0]
  assert.deepEqual([l.professor, l.percentual, l.base, l.comissaoTotal, l.paga, l.aPagar], ['Jeferson', 40, 200, 80, 80, 80])
  assert.equal(l.detalhe[0].situacao, 'Pago')
})
test('aluno inadimplente aparece na lista, mas a comissão dele fica fora do pagamento', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })] }))
  const l = r.linhas[0]
  assert.deepEqual([l.comissaoTotal, l.paga, l.foraDoPagamento, l.aPagar], [80, 0, 80, 0])
  assert.equal(l.detalhe[0].situacao, 'Inadimplente')
})
test('aluno com vencimento ainda por chegar também fica fora do pagamento enquanto não pagar', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-30' })] }))
  assert.deepEqual([r.linhas[0].paga, r.linhas[0].foraDoPagamento, r.linhas[0].detalhe[0].situacao], [0, 80, 'A vencer'])
})
test('pagamento parcial: só a parte paga entra no pagamento', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })], entradas: [{ aluno_ref_id: 'a1', valor: 50, competencia: '2026-10' }] }))
  assert.deepEqual([r.linhas[0].comissaoTotal, r.linhas[0].foraDoPagamento, r.linhas[0].paga], [80, 60, 20]) // pagou 25% do valor
})
test('pagamento da competência anterior não vale para o mês escolhido', () => {
  const r = comissaoPorProfessor(base({ alunos: [aluno({ data_vencimento: '2026-10-10' })], entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-09' }] }))
  assert.equal(r.linhas[0].foraDoPagamento, 80)
})
test('o que o aluno paga fora das aulas entra na conta de quitação', () => {
  // Aula 200 (professor) + Clubinho 100 (sem professor): pagou só 100 de 300
  const r = comissaoPorProfessor(base({
    alunos: [aluno({ data_vencimento: '2026-10-10' })],
    matriculas: [mat(), mat({ tipo: 'Clubinho', valor: 100, professor_nome: null })],
    entradas: [{ aluno_ref_id: 'a1', valor: 100, competencia: '2026-10' }],
  }))
  assert.equal(r.linhas[0].comissaoTotal, 80) // só a aula gera comissão
  assert.equal(r.linhas[0].foraDoPagamento, 53.33) // 80 × (2/3 em falta)
  assert.equal(r.linhas[0].paga, 26.67)
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
  assert.deepEqual([r.totais.comissaoTotal, r.totais.foraDoPagamento, r.totais.paga, r.totais.aPagar], [130, 50, 80, 80])
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

const NOMES = ['Zeca', 'Ana', 'Édson', 'bruno']
test('alunos de cada professor saem em ordem alfabética (sem ligar para acento e caixa)', () => {
  const alunos = NOMES.map((nome, i) => aluno({ id: 'a' + i, nome }))
  const matriculas = NOMES.map((_, i) => mat({ aluno_id: 'a' + i }))
  const r = comissaoPorProfessor(base({ alunos, matriculas }))
  assert.deepEqual(r.linhas[0].detalhe.map(d => d.nome), ['Ana', 'bruno', 'Édson', 'Zeca'])
})

test('mostra a competência e a data em que o aluno pagou', () => {
  const r = comissaoPorProfessor(base({ entradas: [{ aluno_ref_id: 'a1', valor: 100, competencia: '2026-10', data_pagamento: '2026-10-05' }, { aluno_ref_id: 'a1', valor: 100, competencia: '2026-10', data_pagamento: '2026-10-12' }] }))
  const d = r.linhas[0].detalhe[0]
  assert.deepEqual([d.competencia, d.dataPagamento], ['2026-10', '2026-10-12'])
  const sem = comissaoPorProfessor(base())
  assert.equal(sem.linhas[0].detalhe[0].dataPagamento, null)
})

const mov = (o = {}) => ({ professor_id: 'p1', tipo: 'Saída', status: 'Pago', valor: 50, data: '2026-10-08', data_pagamento: '2026-10-08', data_vencimento: null, descricao: null, categoria: 'Mão de Obra', subcategoria: 'Comissão de venda', aluno_ref_id: null, esporte_nome: null, ...o })
test('comissão extra (venda de produto e encordoamento) soma ao pagamento', () => {
  const r = comissaoPorProfessor(base({
    entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-10' }],
    movimentos: [mov(), mov({ subcategoria: 'Comissão de encordoamento', valor: 30 })],
  }))
  const l = r.linhas[0]
  assert.deepEqual([l.extras.length, l.totalExtras, l.aPagar], [2, 80, 160])
  assert.deepEqual(l.extras.map(e => e.tipoAjuste), ['Comissão de venda de produto', 'Comissão de encordoamento'])
})
test('vale, adiantamento e outras despesas do professor viram desconto', () => {
  const r = comissaoPorProfessor(base({
    entradas: [{ aluno_ref_id: 'a1', valor: 200, competencia: '2026-10' }],
    movimentos: [mov({ categoria: 'Aula BT', subcategoria: 'Vale', valor: 20 }), mov({ categoria: 'Mão de Obra', subcategoria: 'Outros', valor: 5, descricao: 'Adiantamento' })],
  }))
  const l = r.linhas[0]
  assert.deepEqual([l.descontos.length, l.totalDescontos, l.aPagar], [2, 25, 55])
})
test('retirada de produto pelo professor: desconta se não foi paga na hora; já paga só aparece', () => {
  const retirada = (o) => mov({ tipo: 'Entrada', status: 'Não recebido', categoria: 'Venda Produto Loja', subcategoria: null, data_pagamento: null, data_vencimento: '2026-10-31', valor: 40, ...o })
  const r = comissaoPorProfessor(base({ movimentos: [retirada({}), retirada({ status: 'Recebido', data_pagamento: '2026-10-09', valor: 15 })] }))
  const l = r.linhas[0]
  assert.deepEqual([l.descontos.length, l.totalDescontos], [2, 40])
  assert.ok(l.descontos.some(d => d.status === 'Já pago' && d.contaNoTotal === 0))
})
test('lançamentos de outro mês, cancelados ou sem professor ficam de fora; professor só com lançamentos aparece', () => {
  const r = comissaoPorProfessor(base({
    alunos: [], matriculas: [],
    movimentos: [mov({ data: '2026-09-30', data_pagamento: '2026-09-30' }), mov({ status: 'Cancelado' }), mov({ professor_id: null }), mov({ valor: 12 })],
  }))
  assert.deepEqual([r.linhas.length, r.linhas[0].totalExtras, r.linhas[0].alunos], [1, 12, 0])
})

test('comparação entre períodos: indicadores lado a lado, diferença e variação', async () => {
  const { compararPeriodos } = await import('../lib/relatorios-gerenciais.ts')
  const e = (valor, dia, categoria = 'Mensalidade') => ({ tipo: 'Entrada', status: 'Recebido', valor, data: dia, data_pagamento: dia, categoria })
  const s = (valor, dia) => ({ tipo: 'Saída', status: 'Pago', valor, data: dia, data_pagamento: dia, categoria: 'Aluguel' })
  const r = compararPeriodos({
    movs: [e(1000, '2026-10-05'), e(100, '2026-10-06', 'Venda Produto Loja'), s(400, '2026-10-07'), e(800, '2026-09-05'), s(500, '2026-09-07'), { ...e(50, '2026-10-08'), status: 'Não recebido' }],
    alunos: [{ data_cadastro: '2026-10-02', data_saida: null }, { data_cadastro: '2026-09-10', data_saida: '2026-10-15' }, { data_cadastro: '2026-09-11', data_saida: null }],
    atual: { inicio: '2026-10-01', fim: '2026-10-31' }, anterior: { inicio: '2026-09-01', fim: '2026-09-30' },
  })
  const por = Object.fromEntries(r.map(l => [l.chave, l]))
  assert.deepEqual([por.faturamento.atual, por.faturamento.anterior, por.faturamento.diferenca, por.faturamento.variacaoPct], [1100, 800, 300, 37.5])
  assert.deepEqual([por.despesas.atual, por.despesas.anterior, por.despesas.subiuEhBom], [400, 500, false])
  assert.deepEqual([por.lucro.atual, por.lucro.anterior], [700, 300])
  assert.equal(por.vendas.atual, 100)
  assert.deepEqual([por.novos.atual, por.novos.anterior, por.inativacoes.atual, por.inativacoes.anterior], [1, 2, 1, 0])
  assert.equal(por.inativacoes.variacaoPct, null)
})

test('relatório de estoque: vendas, lucro e compras do período, e situação pelo saldo de hoje', async () => {
  const { relatorioEstoque } = await import('../lib/relatorios-gerenciais.ts')
  const produtos = [
    { id: 'p1', nome: 'Bola', categoria: 'Bolas', custo: 5, limite_compra: 10 },
    { id: 'p2', nome: 'Overgrip', categoria: null, custo: 2, limite_compra: 5 },
    { id: 'p3', nome: 'Raquete', categoria: null, custo: 100, limite_compra: 2 },
  ]
  const r = relatorioEstoque({
    produtos, saldos: { p1: 8, p2: 30, p3: 0 }, inicio: '2026-10-01', fim: '2026-10-31',
    retiradas: [
      { produto_id: 'p1', data: '2026-10-05', quantidade: 2, preco_unitario: 10, custo_unitario: 5 },
      { produto_id: 'p2', data: '2026-10-06', quantidade: 10, preco_unitario: 5, custo_unitario: 2 },
      { produto_id: 'p1', data: '2026-09-30', quantidade: 99, preco_unitario: 10, custo_unitario: 5 },
    ],
    compras: [{ produto_id: 'p1', data: '2026-10-02', quantidade: 20, custo_unitario: 5 }],
  })
  assert.deepEqual(r.linhas.map(l => [l.nome, l.vendidos, l.lucro, l.situacao]), [['Overgrip', 10, 30, 'OK'], ['Bola', 2, 10, 'ATENÇÃO'], ['Raquete', 0, 0, 'COMPRAR']])
  assert.deepEqual([r.totais.faturamento, r.totais.lucro, r.totais.gastoCompras], [70, 40, 100])
})
