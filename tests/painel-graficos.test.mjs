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
