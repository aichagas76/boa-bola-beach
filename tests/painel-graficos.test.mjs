import { test } from 'node:test'
import assert from 'node:assert/strict'
import { janelaDeMeses, mesesEntre, serieMensal } from '../lib/painel-graficos.ts'

test('janela de N meses conta o mês atual e termina hoje', () => {
  assert.deepEqual(janelaDeMeses(1, '2026-10-27'), { inicio: '2026-10-01', fim: '2026-10-27' })
  assert.deepEqual(janelaDeMeses(3, '2026-10-27'), { inicio: '2026-08-01', fim: '2026-10-27' })
  assert.deepEqual(janelaDeMeses(12, '2026-10-27'), { inicio: '2025-11-01', fim: '2026-10-27' })
})

test('meses entre duas datas, inclusive os vazios e virando o ano', () => {
  assert.deepEqual(mesesEntre('2025-11-15', '2026-02-03'), ['2025-11', '2025-12', '2026-01', '2026-02'])
  assert.deepEqual(mesesEntre('2026-02-01', '2026-01-01'), [])
})

test('série mensal soma valores e conta eventos, só dentro da janela', () => {
  const r = serieMensal([
    { data: '2026-08-10', valor: 10.1 }, { data: '2026-08-20', valor: 0.2 }, { data: '2026-10-05', valor: 50 },
    { data: '2026-07-31', valor: 999 }, { data: '2026-10-28', valor: 999 },
  ], { inicio: '2026-08-01', fim: '2026-10-27' })
  assert.deepEqual(r.map(p => [p.rotulo, p.total, p.qtd]), [['ago/26', 10.3, 2], ['set/26', 0, 0], ['out/26', 50, 1]])
})

test('série mensal separa em grupos e conta 1 por evento sem valor', () => {
  const r = serieMensal([
    { data: '2026-09-01', grupo: 'registrado' }, { data: '2026-09-02', grupo: 'estimado' }, { data: '2026-09-03', grupo: 'estimado' },
  ], { inicio: '2026-09-01', fim: '2026-09-30' }, ['registrado', 'estimado'])
  assert.deepEqual([r[0].total, r[0].registrado, r[0].estimado], [3, 1, 2])
})

test('despesas por categoria: só saída paga no período, maiores primeiro, resto em Outras', async () => {
  const { despesasPorCategoria } = await import('../lib/painel-graficos.ts')
  const s = (valor, data, categoria, extra = {}) => ({ tipo: 'Saída', status: 'Pago', valor, data, data_pagamento: data, categoria, ...extra })
  const movs = [
    s(100, '2026-10-02', 'Aluguel'), s(50, '2026-10-05', 'Aluguel'), s(30, '2026-10-06', 'Luz'), s(20, '2026-10-07', null),
    s(999, '2026-09-30', 'Aluguel'), s(10, '2026-10-08', 'Água', { status: 'Pendente' }),
    { tipo: 'Entrada', status: 'Recebido', valor: 500, data: '2026-10-03', data_pagamento: '2026-10-03', categoria: 'Mensalidade' },
  ]
  const r = despesasPorCategoria(movs, { inicio: '2026-10-01', fim: '2026-10-31' }, 2)
  assert.deepEqual(r.map(x => [x.name, x.value]), [['Aluguel', 150], ['Luz', 30], ['Outras', 20]])
  assert.equal(Math.round(r[0].pct), 75)
})

test('despesas por categoria: categoria excluída sai do cálculo e do percentual', async () => {
  const { despesasPorCategoria } = await import('../lib/painel-graficos.ts')
  const s = (valor, categoria) => ({ tipo: 'Saída', status: 'Pago', valor, data: '2026-10-02', data_pagamento: '2026-10-02', categoria })
  const r = despesasPorCategoria([s(300, 'Mão de Obra'), s(100, 'Aluguel'), s(100, 'Luz')], { inicio: '2026-10-01', fim: '2026-10-31' }, 8, ['Mão de Obra'])
  assert.deepEqual(r.map(x => [x.name, x.value, Math.round(x.pct)]), [['Aluguel', 100, 50], ['Luz', 100, 50]])
})

test('faturamento dos professores: ranking, por mês e alunos que pagaram', async () => {
  const { faturamentoProfessores } = await import('../lib/painel-graficos.ts')
  const e = (prof, nome, valor, dia, aluno, extra = {}) => ({ tipo: 'Entrada', status: 'Recebido', valor, data: dia, data_pagamento: dia, professor_id: prof, professor_nome: nome, esporte_nome: 'Tênis', aluno_ref_id: aluno, ...extra })
  const movs = [
    e('p1', 'Ana', 100, '2026-09-10', 'a1'), e('p1', 'Ana', 100, '2026-09-12', 'a1'), e('p1', 'Ana', 50, '2026-10-02', 'a2', { esporte_nome: 'Padel' }),
    e('p2', 'Bia', 400, '2026-10-05', 'a3'),
    e('p1', 'Ana', 999, '2026-07-01', 'a9'), e('p1', 'Ana', 10, '2026-10-03', 'a4', { status: 'Não recebido' }),
    e(null, null, 5, '2026-10-04', 'a5'),
  ]
  const j = { inicio: '2026-08-01', fim: '2026-10-27' }
  const todos = faturamentoProfessores(movs, j)
  assert.deepEqual(todos.ranking.map(r => [r.professor, r.total, r.qtd]), [['Bia', 400, 1], ['Ana', 250, 3]])
  assert.deepEqual(todos.ranking[1].porEsporte, { 'Tênis': 200, Padel: 50 })
  assert.deepEqual(todos.porMes.map(p => [p.rotulo, p.total, p.alunos]), [['ago/26', 0, 0], ['set/26', 200, 1], ['out/26', 450, 2]])
  const ana = faturamentoProfessores(movs, j, 'p1')
  assert.deepEqual(ana.porMes.map(p => [p.total, p.alunos]), [[0, 0], [200, 1], [50, 1]])
})
