import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normaliza, parseDataBR, parseValorBR, parseComissao, formataCelular, formataCpf, esporteDe, formaDe, tipoMovDe, modalidadeDe, uuidV5, situacaoMov,
} from '../lib/importacao-bb.ts'

test('datas no formato da planilha', () => {
  assert.equal(parseDataBR('26/07/2026'), '2026-07-26')
  assert.equal(parseDataBR('5/8/2026 15:53:20'), '2026-08-05')
  assert.equal(parseDataBR(''), null)
  assert.equal(parseDataBR('2026-07-26'), null)
  assert.equal(parseDataBR('32/01/2026'), null)
})
test('valores em reais', () => {
  assert.equal(parseValorBR('R$ 1.234,56'), 1234.56)
  assert.equal(parseValorBR('R$ 120,00'), 120)
  assert.equal(parseValorBR('8,00'), 8)
  assert.equal(parseValorBR('120'), 120)
  assert.equal(parseValorBR(''), null)
  assert.equal(parseValorBR('abc'), null)
})
test('comissão do professor', () => {
  assert.equal(parseComissao('0,5'), 50)
  assert.equal(parseComissao('35,00%'), 35)
  assert.equal(parseComissao('100%'), 100)
  assert.equal(parseComissao('0,35'), 35)
  assert.equal(parseComissao('0,00%'), 0)
  assert.equal(parseComissao(''), 0)
})
test('celular e CPF', () => {
  assert.equal(formataCelular('19 982220600'), '(19) 98222-0600')
  assert.equal(formataCelular('1932220600'), '(19) 3222-0600')
  assert.equal(formataCelular('5519982220600'), '(19) 98222-0600')
  assert.equal(formataCelular('12345'), null)
  assert.equal(formataCpf('26792617806'), '267.926.178-06')
  assert.equal(formataCpf('13485-514'), null)
  assert.equal(formataCpf(''), null)
})
test('esporte, forma de pagamento, tipo e modalidade', () => {
  assert.equal(esporteDe('Beach Tennis'), 'Beach Tênis')
  assert.equal(esporteDe('Tênis'), 'Tênis')
  assert.equal(esporteDe('GERAL'), null)
  assert.equal(esporteDe('Rateio'), null)
  assert.equal(formaDe('Cartão de crédito'), 'Cartão Crédito')
  assert.equal(formaDe('Cartão de débito'), 'Cartão Débito')
  assert.equal(formaDe('PIX ASAAS'), 'PIX Asaas')
  assert.equal(formaDe('PIX'), 'Pix')
  assert.equal(formaDe(''), 'Pix')
  assert.equal(tipoMovDe('SAÍDA'), 'Saída')
  assert.equal(tipoMovDe('ENTRADA'), 'Entrada')
  assert.equal(tipoMovDe(''), null)
  assert.equal(modalidadeDe('CLUBINHO'), 'Clubinho')
  assert.equal(modalidadeDe('OUTROS'), null)
  assert.equal(normaliza('  Flávio  Silva '), 'flavio silva')
})
test('uuid v5 é estável e bate com o valor conhecido do padrão', () => {
  assert.equal(uuidV5('python.org'), '886313e1-3b8a-5372-9b90-0c9aee199e5d') // exemplo da documentação do uuid5 (namespace DNS)
  assert.equal(uuidV5('bb1:cadastro:abc'), uuidV5('bb1:cadastro:abc'))
  assert.notEqual(uuidV5('bb1:cadastro:abc'), uuidV5('bb1:cadastro:abd'))
})
test('situação do lançamento sempre coerente com as regras do banco', () => {
  assert.deepEqual(situacaoMov('Entrada', 'Recebido', '2026-02-01', '2026-01-30'), { status: 'Recebido', dataPagamento: '2026-02-01' })
  assert.equal(situacaoMov('Saída', 'Pago', null, '2026-01-30').dataPagamento, '2026-01-30') // pago sem data: usa o vencimento
  assert.ok(situacaoMov('Saída', 'Pago', null, '2026-01-30').correcao)
  assert.deepEqual(situacaoMov('Entrada', 'Não Recebido', null, '2026-01-30'), { status: 'Não recebido', dataPagamento: null })
  assert.equal(situacaoMov('Saída', 'Pendente', null, '2026-01-30').status, 'Pendente')
  assert.equal(situacaoMov('Entrada', 'Pendente', '2026-01-31', '2026-01-30').status, 'Recebido') // em aberto com data: foi pago
  assert.equal(situacaoMov('Saída', '', '2026-01-31', '2026-01-30').status, 'Pago')
  assert.equal(situacaoMov('Saída', '', null, '2026-01-30').status, 'Pendente')
})

test('valores já em número puro (como vêm da planilha convertida)', () => {
  assert.equal(parseValorBR('5000.5'), 5000.5)
  assert.equal(parseValorBR('30'), 30)
  assert.equal(parseValorBR('0'), 0)
})
