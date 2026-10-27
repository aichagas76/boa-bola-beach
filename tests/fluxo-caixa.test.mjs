import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fluxoDeCaixa, granularidadeAuto, foiRealizado, SEM_CONTA } from '../lib/fluxo-caixa.ts'

const e = (valor, dia, extra = {}) => ({ tipo: 'Entrada', status: 'Recebido', valor, data: dia, data_pagamento: dia, ...extra })
const s = (valor, dia, extra = {}) => ({ tipo: 'Saída', status: 'Pago', valor, data: dia, data_pagamento: dia, ...extra })

test('só conta o que já entrou ou saiu', () => {
  assert.equal(foiRealizado(e(10, '2026-01-01')), true)
  assert.equal(foiRealizado(s(10, '2026-01-01')), true)
  assert.equal(foiRealizado({ tipo: 'Entrada', status: 'Não recebido', valor: 1, data: '2026-01-01', data_pagamento: null }), false)
  assert.equal(foiRealizado({ tipo: 'Saída', status: 'Pendente', valor: 1, data: '2026-01-01', data_pagamento: null }), false)
  assert.equal(foiRealizado({ tipo: 'Entrada', status: 'Estornado', valor: 1, data: '2026-01-01', data_pagamento: '2026-01-01' }), false)
})

test('por mês: entradas, saídas, saldo e acumulado', () => {
  const r = fluxoDeCaixa([e(100, '2026-01-10'), s(40, '2026-01-20'), e(50, '2026-02-03'), s(80, '2026-02-04')], { inicio: '2026-01-01', fim: '2026-03-31', granularidade: 'mes' })
  assert.deepEqual(r.pontos.map(p => [p.rotulo, p.entradas, p.saidas, p.saldo, p.acumulado]), [
    ['jan/26', 100, 40, 60, 60], ['fev/26', 50, 80, -30, 30], ['mar/26', 0, 0, 0, 30],
  ])
  assert.equal(r.entradas, 150)
  assert.equal(r.saidas, 120)
  assert.equal(r.saldo, 30)
  assert.equal(r.maiorSaida.rotulo, 'fev/26')
  assert.equal(r.menorSaldo.rotulo, 'fev/26')
})

test('usa a data do pagamento; sem ela, a do lançamento', () => {
  const r = fluxoDeCaixa([{ tipo: 'Entrada', status: 'Recebido', valor: 10, data: '2026-01-31', data_pagamento: '2026-02-02' }, { tipo: 'Saída', status: 'Pago', valor: 5, data: '2026-02-05', data_pagamento: null }], { inicio: '2026-01-01', fim: '2026-02-28', granularidade: 'mes' })
  assert.deepEqual(r.pontos.map(p => [p.entradas, p.saidas]), [[0, 0], [10, 5]])
})

test('por dia, cada dia do período aparece, mesmo sem movimento', () => {
  const r = fluxoDeCaixa([e(10, '2026-10-02')], { inicio: '2026-10-01', fim: '2026-10-03', granularidade: 'dia' })
  assert.deepEqual(r.pontos.map(p => [p.rotulo, p.entradas]), [['01/10', 0], ['02/10', 10], ['03/10', 0]])
})

test('por semana: começa na segunda e as pontas são cortadas no período', () => {
  // 2026-10-01 é quinta; semana de 28/09 a 04/10 entra cortada em 01/10
  const r = fluxoDeCaixa([e(10, '2026-10-01'), e(20, '2026-10-05'), e(30, '2026-10-11'), e(40, '2026-10-12')], { inicio: '2026-10-01', fim: '2026-10-14', granularidade: 'semana' })
  assert.deepEqual(r.pontos.map(p => [p.inicio, p.fim, p.entradas]), [['2026-10-01', '2026-10-04', 10], ['2026-10-05', '2026-10-11', 50], ['2026-10-12', '2026-10-14', 40]])
  assert.equal(r.pontos[0].rotulo, '01/10–04/10')
})

test('fora do período não entra', () => {
  const r = fluxoDeCaixa([e(10, '2025-12-31'), e(20, '2026-01-01'), e(30, '2026-02-01')], { inicio: '2026-01-01', fim: '2026-01-31', granularidade: 'mes' })
  assert.equal(r.entradas, 20)
})

test('filtro por conta e por "sem conta"', () => {
  const movs = [e(100, '2026-01-10', { conta_id: 'a' }), e(50, '2026-01-11', { conta_id: 'b' }), s(30, '2026-01-12'), e(5, '2026-01-13', { conta_id: null })]
  const base = { inicio: '2026-01-01', fim: '2026-01-31', granularidade: 'mes' }
  assert.equal(fluxoDeCaixa(movs, { ...base, conta: 'a' }).entradas, 100)
  assert.equal(fluxoDeCaixa(movs, { ...base, conta: 'b' }).entradas, 50)
  const sem = fluxoDeCaixa(movs, { ...base, conta: SEM_CONTA })
  assert.deepEqual([sem.entradas, sem.saidas], [5, 30])
  const todas = fluxoDeCaixa(movs, base)
  assert.deepEqual(todas.semConta, { qtd: 2, entradas: 5, saidas: 30 })
  assert.equal(todas.entradas, 155)
})

test('centavos não acumulam erro de ponto flutuante', () => {
  const r = fluxoDeCaixa([e(0.1, '2026-01-01'), e(0.2, '2026-01-02'), s(0.3, '2026-01-03')], { inicio: '2026-01-01', fim: '2026-01-31', granularidade: 'mes' })
  assert.equal(r.entradas, 0.3)
  assert.equal(r.saldo, 0)
})

test('período vazio ou invertido não quebra', () => {
  assert.deepEqual(fluxoDeCaixa([], { inicio: '2026-01-01', fim: '2026-01-31', granularidade: 'mes' }).pontos.length, 1)
  assert.deepEqual(fluxoDeCaixa([e(1, '2026-01-01')], { inicio: '2026-02-01', fim: '2026-01-01', granularidade: 'dia' }).pontos, [])
  assert.equal(fluxoDeCaixa([], { inicio: '2026-01-01', fim: '2026-01-31', granularidade: 'mes' }).maiorSaida, null)
})

test('granularidade automática pelo tamanho do período', () => {
  assert.equal(granularidadeAuto('2026-10-01', '2026-10-27'), 'dia')
  assert.equal(granularidadeAuto('2026-08-01', '2026-10-27'), 'semana')
  assert.equal(granularidadeAuto('2026-05-01', '2026-10-27'), 'mes')
})
