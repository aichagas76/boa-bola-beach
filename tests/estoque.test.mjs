import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saldo, situacao, precoUnitario, totalVenda, lucroVenda, validarVenda, validarCompra, vencimentoNaMensalidade, vencimentoProfessor, lucroTotal } from '../lib/estoque.ts'

test('saldo é o que entrou menos o que saiu', () => {
  assert.equal(saldo([10, 5], [3, 2]), 10)
  assert.equal(saldo([], []), 0)
})
test('alerta: no limite compra, perto do limite atenção, folgado OK', () => {
  assert.equal(situacao(0, 4), 'COMPRAR')
  assert.equal(situacao(4, 4), 'COMPRAR')
  assert.equal(situacao(5, 4), 'ATENÇÃO')
  assert.equal(situacao(6, 4), 'ATENÇÃO')
  assert.equal(situacao(7, 4), 'OK')
})
test('preço do professor é diferente; sem preço de professor vale o do aluno', () => {
  const p = { preco_aluno: 30, preco_professor: 24 }
  assert.equal(precoUnitario(p, 'aluno'), 30)
  assert.equal(precoUnitario(p, 'professor'), 24)
  assert.equal(precoUnitario({ preco_aluno: 30, preco_professor: null }, 'professor'), 30)
})
test('total e lucro com centavos', () => {
  assert.equal(totalVenda(19.9, 3), 59.7)
  assert.equal(lucroVenda(30, 18.5, 2), 23)
  assert.equal(lucroTotal([{ preco_unitario: 30, custo_unitario: 20, quantidade: 2 }, { preco_unitario: 24, custo_unitario: 20, quantidade: 1 }]), 24)
})
test('venda: quantidade, estoque e comprador', () => {
  const ok = { quantidade: 2, saldo: 5, comprador: 'aluno', aluno_id: 'a', preco: 10 }
  assert.deepEqual(validarVenda(ok), [])
  assert.match(validarVenda({ ...ok, quantidade: 6 })[0], /insuficiente/)
  assert.match(validarVenda({ ...ok, quantidade: 0 })[0], /quantidade/)
  assert.match(validarVenda({ ...ok, quantidade: 1.5 })[0], /quantidade/)
  assert.match(validarVenda({ ...ok, aluno_id: null })[0], /aluno/)
  assert.match(validarVenda({ ...ok, comprador: 'professor', professor_id: null })[0], /professor/)
})
test('compra: quantidade e custo', () => {
  assert.deepEqual(validarCompra({ quantidade: 3, custo_unitario: 0 }), [])
  assert.equal(validarCompra({ quantidade: 0, custo_unitario: 5 }).length, 1)
  assert.equal(validarCompra({ quantidade: 1, custo_unitario: -1 }).length, 1)
})
test('venda não paga do aluno vence no próximo dia de vencimento da mensalidade', () => {
  assert.equal(vencimentoNaMensalidade('2026-10-26', '2026-01-10'), '2026-11-10')
  assert.equal(vencimentoNaMensalidade('2026-10-05', '2026-01-10'), '2026-10-10')
  assert.equal(vencimentoNaMensalidade('2026-10-10', '2026-01-10'), '2026-10-10')
  assert.equal(vencimentoNaMensalidade('2026-12-20', '2026-01-05'), '2027-01-05')
  assert.equal(vencimentoNaMensalidade('2027-01-31', '2026-01-30'), '2027-02-28') // fevereiro curto
  assert.equal(vencimentoNaMensalidade('2026-10-26', null), '2026-10-31')
})
test('venda não paga do professor vence no fim do mês', () => {
  assert.equal(vencimentoProfessor('2026-02-10'), '2026-02-28')
  assert.equal(vencimentoProfessor('2026-10-26'), '2026-10-31')
})

import { comissaoIndicacao } from '../lib/estoque.ts'
test('comissão de indicação é % do valor da venda, em centavos', () => {
  assert.equal(comissaoIndicacao(200, 10), 20)
  assert.equal(comissaoIndicacao(50, 5), 2.5)
  assert.equal(comissaoIndicacao(19.9, 7), 1.39)
  assert.equal(comissaoIndicacao(100, 0), 0)
})

test('encordoamento começa com 10% de indicação e R$ 10 por unidade, se o produto não tiver outro valor', async () => {
  const { padroesEncordoamento } = await import('../lib/estoque.ts')
  assert.equal(padroesEncordoamento({ encordoamento: false, comissao_indicacao: 0, comissao_valor: 0 }), null)
  assert.deepEqual(padroesEncordoamento({ encordoamento: true, comissao_indicacao: 0, comissao_valor: 0 }), { indicacaoPct: 10, valorPorUnidade: 10 })
  assert.deepEqual(padroesEncordoamento({ encordoamento: true }), { indicacaoPct: 10, valorPorUnidade: 10 })
  assert.deepEqual(padroesEncordoamento({ encordoamento: true, comissao_indicacao: 15, comissao_valor: 12.5 }), { indicacaoPct: 15, valorPorUnidade: 12.5 })
})
