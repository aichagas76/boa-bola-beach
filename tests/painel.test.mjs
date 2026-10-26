import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  periodoDe, mesesDaJanela, deslocarMes, itensFinanceiros, calcularKpis, variacao,
  serieFinanceira, serieAlunos, statusDosPagamentos, faixasDeAtraso, participacao, somarDias,
} from '../lib/painel.ts'

const HOJE = '2026-10-26'
const mov = (o = {}) => ({ tipo: 'Entrada', status: 'Recebido', valor: 100, data: '2026-10-05', data_pagamento: null, data_vencimento: null, aluno_ref_id: 'a1', ...o })
const aluno = (o = {}) => ({ id: 'a1', status: 'Ativo', data_cadastro: '2026-01-10', data_inativacao: null, data_vencimento: '2026-11-10', ...o })

test('períodos: mês atual compara com os mesmos dias do mês anterior', () => {
  assert.deepEqual(periodoDe('mes_atual', HOJE), { inicio: '2026-10-01', fim: HOJE, inicioAnt: '2026-09-01', fimAnt: '2026-09-26' })
  // não passa do fim do mês anterior (31/03 -> fevereiro tem 28)
  assert.equal(periodoDe('mes_atual', '2026-03-31').fimAnt, '2026-02-28')
})
test('períodos: mês anterior, 3 e 6 meses e personalizado', () => {
  assert.deepEqual(periodoDe('mes_anterior', HOJE), { inicio: '2026-09-01', fim: '2026-09-30', inicioAnt: '2026-08-01', fimAnt: '2026-08-31' })
  assert.deepEqual(periodoDe('3m', HOJE), { inicio: '2026-08-01', fim: HOJE, inicioAnt: '2026-05-01', fimAnt: '2026-07-31' })
  assert.equal(periodoDe('6m', HOJE).inicio, '2026-05-01')
  assert.deepEqual(periodoDe('custom', HOJE, '2026-10-10', '2026-10-19'), { inicio: '2026-10-10', fim: '2026-10-19', inicioAnt: '2026-09-30', fimAnt: '2026-10-09' })
  // intervalo invertido não quebra
  assert.equal(periodoDe('custom', HOJE, '2026-10-20', '2026-10-10').inicio, HOJE)
})
test('janela de meses tem no mínimo 6 e atravessa o ano', () => {
  assert.deepEqual(mesesDaJanela('2026-10-01', HOJE), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
  assert.equal(mesesDaJanela('2025-01-01', HOJE).length, 22)
  assert.equal(deslocarMes('2026-01', -1), '2025-12')
  assert.equal(somarDias('2026-02-28', 1), '2026-03-01')
})

test('itens: cobrança paga não conta duas vezes, cancelada e sem data ficam de fora do aberto', () => {
  const itens = itensFinanceiros(
    [mov({ valor: 100 }), mov({ tipo: 'Saída', valor: 50 }), mov({ status: 'Pendente', valor: 70, data_vencimento: '2026-10-30' }), mov({ status: 'Estornado', valor: 10 })],
    [
      { aluno_id: 'a1', valor: 100, status: 'Pago', data_vencimento: '2026-10-05' }, // já virou entrada: ignora
      { aluno_id: 'a2', valor: 90, status: 'Atrasado', data_vencimento: '2026-10-01' },
      { aluno_id: 'a3', valor: 60, status: 'Cancelado', data_vencimento: '2026-10-02' },
      { aluno_id: 'a4', valor: 40, status: 'Pendente', data_vencimento: null }, // sem data: não classifica
    ]
  )
  assert.deepEqual(itens.map(i => [i.estado, i.valor]), [['pago', 100], ['aberto', 70], ['cancelado', 10], ['aberto', 90], ['cancelado', 60]])
})

test('receita recebida usa a data do pagamento e compara com o período anterior', () => {
  const itens = itensFinanceiros([
    mov({ valor: 300, data: '2026-09-28', data_pagamento: '2026-10-02' }), // vencia em setembro, pago em outubro
    mov({ valor: 120, data: '2026-09-10' }),
    mov({ valor: 999, status: 'Não recebido' }),
  ], [])
  const k = calcularKpis({ alunos: [aluno()], mats: [], itens, periodo: periodoDe('mes_atual', HOJE), hoje: HOJE, modalidade: null })
  assert.equal(k.recebida, 300)
  assert.equal(k.recebidaAnt, 120)
})
test('receita prevista = recebida + em aberto que vence no período', () => {
  const itens = itensFinanceiros([mov({ valor: 300 }), mov({ status: 'Pendente', valor: 80, data: '2026-10-20', data_vencimento: '2026-10-28' })], [
    { aluno_id: 'a1', valor: 50, status: 'Pendente', data_vencimento: '2026-11-05' }, // vence no mês seguinte: fora
  ])
  const k = calcularKpis({ alunos: [aluno()], mats: [], itens, periodo: { inicio: '2026-10-01', fim: '2026-10-31', inicioAnt: '2026-09-01', fimAnt: '2026-09-30' }, hoje: HOJE, modalidade: null })
  assert.equal(k.prevista, 380)
})
test('inadimplência: vencido em aberto ou vencimento do cadastro passado; denominador = ativos', () => {
  const alunos = [
    aluno({ id: 'a1' }), // em dia
    aluno({ id: 'a2', data_vencimento: '2026-10-10' }), // cadastro vencido
    aluno({ id: 'a3' }), // cobrança vencida em aberto
    aluno({ id: 'a4', status: 'Inativo', data_vencimento: '2026-01-01' }), // inativo não conta
  ]
  const itens = itensFinanceiros([], [{ aluno_id: 'a3', valor: 90, status: 'Atrasado', data_vencimento: '2026-10-01' }])
  const k = calcularKpis({ alunos, mats: [], itens, periodo: periodoDe('mes_atual', HOJE), hoje: HOJE, modalidade: null })
  assert.equal(k.alunosAtivos, 3)
  assert.equal(k.inadimplentes, 2)
  assert.ok(Math.abs(k.inadimplenciaPct - 66.666) < 0.01)
  assert.deepEqual([k.abertoQtd, k.vencidoQtd, k.vencidoValor], [1, 1, 90])
})
test('sem alunos ativos não existe percentual de inadimplência', () => {
  const k = calcularKpis({ alunos: [], mats: [], itens: [], periodo: periodoDe('mes_atual', HOJE), hoje: HOJE, modalidade: null })
  assert.equal(k.inadimplenciaPct, null)
})
test('novos, inativações e crescimento líquido', () => {
  const alunos = [
    aluno({ id: 'a1', data_cadastro: '2026-10-03' }),
    aluno({ id: 'a2', data_cadastro: '2026-10-15' }),
    aluno({ id: 'a3', status: 'Inativo', data_cadastro: '2026-02-01', data_inativacao: '2026-10-20' }),
    aluno({ id: 'a4', data_cadastro: '2026-09-10' }),
  ]
  const k = calcularKpis({ alunos, mats: [], itens: [], periodo: periodoDe('mes_atual', HOJE), hoje: HOJE, modalidade: null })
  assert.deepEqual([k.novos, k.novosAnt, k.inativacoes, k.crescimento], [2, 1, 1, 1])
})
test('filtro por modalidade só considera os alunos daquela modalidade', () => {
  const alunos = [aluno({ id: 'a1' }), aluno({ id: 'a2' })]
  const mats = [{ aluno_id: 'a1', tipo: 'Ranking', valor: 50 }, { aluno_id: 'a2', tipo: 'Clubinho', valor: 100 }]
  const itens = itensFinanceiros([mov({ aluno_ref_id: 'a1', valor: 50 }), mov({ aluno_ref_id: 'a2', valor: 100 }), mov({ aluno_ref_id: null, valor: 7 })], [])
  const k = calcularKpis({ alunos, mats, itens, periodo: periodoDe('mes_atual', HOJE), hoje: HOJE, modalidade: 'Ranking' })
  assert.deepEqual([k.alunosAtivos, k.recebida, k.potencialMensal], [1, 50, 50])
})
test('variação percentual', () => {
  assert.equal(variacao(150, 100), 50)
  assert.equal(variacao(50, 100), -50)
  assert.equal(variacao(10, 0), null)
  assert.equal(variacao(0, 0), 0)
})

test('série financeira compara cada mês com o mesmo mês da janela anterior', () => {
  const itens = itensFinanceiros([
    mov({ valor: 100, data: '2026-10-05' }), mov({ valor: 40, data: '2026-04-05' }),
    mov({ status: 'Pendente', valor: 30, data: '2026-10-10', data_vencimento: '2026-10-25' }),
  ], [])
  const meses = mesesDaJanela('2026-05-01', HOJE) // mai..out
  const out = serieFinanceira(itens, meses).at(-1)
  assert.deepEqual([out.mes, out.recebida, out.aReceber, out.prevista], ['2026-10', 100, 30, 130])
  assert.equal(serieFinanceira(itens, meses)[0].anterior, 0) // mai/26 vs nov/25
  assert.equal(serieFinanceira(itens, ['2026-10', '2026-11']).at(0).anterior, 0)
})
test('série de alunos: base = cadastrados menos inativações registradas', () => {
  const alunos = [
    aluno({ id: 'a1', data_cadastro: '2026-08-10' }),
    aluno({ id: 'a2', data_cadastro: '2026-09-05' }),
    aluno({ id: 'a3', data_cadastro: '2026-09-20', status: 'Inativo', data_inativacao: '2026-10-02' }),
    aluno({ id: 'a4', data_cadastro: '2026-09-25', status: 'Inativo' }), // inativo sem data registrada
  ]
  const s = serieAlunos(alunos, ['2026-08', '2026-09', '2026-10'])
  assert.deepEqual(s.map(x => x.base), [1, 4, 3])
  assert.deepEqual(s.map(x => x.novos), [1, 3, 0])
  assert.deepEqual(s.map(x => x.inativacoes), [0, 0, 1])
})

test('status dos pagamentos: pagos no período; a vencer e vencidos de hoje', () => {
  const itens = itensFinanceiros([
    mov({ valor: 100 }),
    mov({ status: 'Pendente', valor: 60, data_vencimento: '2026-10-30' }),
    mov({ status: 'Pendente', valor: 40, data_vencimento: '2026-10-10' }),
    mov({ status: 'Cancelado', valor: 25, data_vencimento: '2026-10-12' }),
  ], [])
  const fatias = statusDosPagamentos(itens, periodoDe('mes_atual', HOJE), HOJE)
  assert.deepEqual(fatias.map(f => [f.nome, f.qtd, f.valor]), [['Pagos', 1, 100], ['A vencer', 1, 60], ['Vencidos', 1, 40], ['Cancelados', 1, 25]])
})
test('faixas de atraso nos limites 7, 8, 30 e 31 dias', () => {
  const venc = n => ({ tipo: 'Entrada', status: 'Pendente', valor: 10, data: '2026-01-01', data_pagamento: null, aluno_ref_id: null, data_vencimento: somarDias(HOJE, -n) })
  const itens = itensFinanceiros([venc(1), venc(7), venc(8), venc(30), venc(31), venc(0)], []) // vencendo hoje não é atraso
  assert.deepEqual(faixasDeAtraso(itens, HOJE).map(f => f.qtd), [2, 2, 1])
})
test('participação soma 100%', () => {
  const p = participacao([{ total: 3 }, { total: 1 }])
  assert.deepEqual(p.map(x => x.pct), [75, 25])
  assert.equal(participacao([{ total: 0 }])[0].pct, 0)
})
