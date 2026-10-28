import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intervaloDoPeriodo, tipoDaEntrada, filtrarPagamentos, resumoPagamentos, categoriasDeMensalidade } from '../lib/pagamentos-aluno.ts'

const HOJE = '2026-10-28'

test('intervalos: dia, 7 dias, mês, semestre, ano, data escolhida e tudo', () => {
  assert.deepEqual(intervaloDoPeriodo('dia', HOJE), { inicio: '2026-10-28', fim: '2026-10-28' })
  assert.deepEqual(intervaloDoPeriodo('7dias', HOJE), { inicio: '2026-10-22', fim: '2026-10-28' })
  assert.deepEqual(intervaloDoPeriodo('mes', HOJE), { inicio: '2026-10-01', fim: '2026-10-31' })
  assert.deepEqual(intervaloDoPeriodo('semestre', HOJE), { inicio: '2026-07-01', fim: '2026-12-31' })
  assert.deepEqual(intervaloDoPeriodo('semestre', '2026-03-10'), { inicio: '2026-01-01', fim: '2026-06-30' })
  assert.deepEqual(intervaloDoPeriodo('ano', HOJE), { inicio: '2026-01-01', fim: '2026-12-31' })
  assert.deepEqual(intervaloDoPeriodo('data', HOJE, '2026-09-01', '2026-09-15'), { inicio: '2026-09-01', fim: '2026-09-15' })
  assert.deepEqual(intervaloDoPeriodo('data', HOJE, '2026-09-01', ''), { inicio: '2026-09-01', fim: '2026-09-01' })
  const t = intervaloDoPeriodo('tudo', HOJE)
  assert.ok(t.inicio < '2000-01-01' && t.fim > '3000-01-01')
  assert.deepEqual(intervaloDoPeriodo('mes', '2026-02-10'), { inicio: '2026-02-01', fim: '2026-02-28' })
})

test('tipo da entrada: venda de produto x mensalidade (aula, clubinho...)', () => {
  assert.equal(tipoDaEntrada('Venda Produto Loja'), 'produto')
  assert.equal(tipoDaEntrada('Aula Tênis'), 'mensalidade')
  assert.equal(tipoDaEntrada('Clubinho'), 'mensalidade')
  assert.equal(tipoDaEntrada(null), 'mensalidade')
})

const e = (id, aluno, categoria, valor, extra = {}) => ({ id, aluno_ref_id: aluno, status: 'Recebido', valor, data: '2026-10-05', data_vencimento: '2026-10-05', data_pagamento: '2026-10-06', categoria, ...extra })
const base = { periodo: { inicio: '2026-10-01', fim: '2026-10-31' }, tipo: 'todos', categoria: '', alunoId: '' }

test('filtra por período (pagas pela data do pagamento, em aberto pelo vencimento), aluno e tipo', () => {
  const lista = [
    e('1', 'a1', 'Aula BT', 100),
    e('2', 'a1', 'Clubinho', 50),
    e('3', 'a2', 'Venda Produto Loja', 20),
    e('4', 'a1', 'Aula BT', 100, { status: 'Não recebido', data_pagamento: null, data_vencimento: '2026-10-20' }),
    e('5', 'a1', 'Aula BT', 100, { data: '2026-09-05', data_vencimento: '2026-09-05', data_pagamento: '2026-09-06' }),
    e('6', 'a1', 'Aula BT', 100, { status: 'Cancelado' }),
    e('7', null, 'Aula BT', 100),
  ]
  assert.deepEqual(filtrarPagamentos(lista, base).map(x => x.id), ['4', '3', '2', '1'])
  assert.equal(filtrarPagamentos(lista, base).length, 4) // 5 é de setembro, 6 cancelada, 7 sem aluno
  assert.deepEqual(filtrarPagamentos(lista, { ...base, alunoId: 'a2' }).map(x => x.id), ['3'])
  assert.deepEqual(filtrarPagamentos(lista, { ...base, tipo: 'produto' }).map(x => x.id), ['3'])
  assert.deepEqual(filtrarPagamentos(lista, { ...base, tipo: 'mensalidade', categoria: 'Clubinho' }).map(x => x.id), ['2'])
  assert.equal(filtrarPagamentos(lista, { ...base, tipo: 'mensalidade' }).length, 3)
  // histórico inteiro do aluno
  assert.equal(filtrarPagamentos(lista, { ...base, periodo: intervaloDoPeriodo('tudo', HOJE), alunoId: 'a1' }).length, 4) // 1, 2, 4, 5
})

test('ordem: do mais recente para o mais antigo', () => {
  const lista = [e('a', 'a1', 'Aula BT', 1, { data_pagamento: '2026-10-02' }), e('b', 'a1', 'Aula BT', 1, { data_pagamento: '2026-10-09' }), e('c', 'a1', 'Aula BT', 1, { data_pagamento: '2026-10-05' })]
  assert.deepEqual(filtrarPagamentos(lista, base).map(x => x.id), ['b', 'c', 'a'])
})

test('resumo: pago, pendente e último pagamento', () => {
  const lista = [e('1', 'a1', 'Aula BT', 100.1), e('2', 'a1', 'Clubinho', 0.2, { data_pagamento: '2026-10-12' }), e('3', 'a1', 'Aula BT', 70, { status: 'Não recebido', data_pagamento: null })]
  assert.deepEqual(resumoPagamentos(lista), { pago: 100.3, pendente: 70, qtdPagos: 2, qtdPendentes: 1, ultimoPagamento: '2026-10-12' })
  assert.deepEqual(resumoPagamentos([]), { pago: 0, pendente: 0, qtdPagos: 0, qtdPendentes: 0, ultimoPagamento: null })
})

test('categorias de mensalidade existentes, sem produto, em ordem', () => {
  assert.deepEqual(categoriasDeMensalidade([e('1', 'a', 'Clubinho', 1), e('2', 'a', 'Aula BT', 1), e('3', 'a', 'Venda Produto Loja', 1), e('4', 'a', 'Clubinho', 1)]), ['Aula BT', 'Clubinho'])
})
