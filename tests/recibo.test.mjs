import { test } from 'node:test'
import assert from 'node:assert/strict'
import { valorPorExtenso, montarRecibo, htmlDoRecibo } from '../lib/recibo.ts'

test('valor por extenso em reais e centavos', () => {
  assert.equal(valorPorExtenso(1), 'um real')
  assert.equal(valorPorExtenso(21), 'vinte e um reais')
  assert.equal(valorPorExtenso(100), 'cem reais')
  assert.equal(valorPorExtenso(130), 'cento e trinta reais')
  assert.equal(valorPorExtenso(1000), 'mil reais')
  assert.equal(valorPorExtenso(1100), 'mil e cem reais')
  assert.equal(valorPorExtenso(2020), 'dois mil e vinte reais')
  assert.equal(valorPorExtenso(1250.5), 'mil duzentos e cinquenta reais e cinquenta centavos')
  assert.equal(valorPorExtenso(0.01), 'um centavo')
  assert.equal(valorPorExtenso(0.5), 'cinquenta centavos')
  assert.equal(valorPorExtenso(305.07), 'trezentos e cinco reais e sete centavos')
  assert.equal(valorPorExtenso(1000000), 'um milhão de reais')
  assert.equal(valorPorExtenso(1200000), 'um milhão e duzentos mil reais')
  assert.equal(valorPorExtenso(0), 'zero reais')
})

const base = { id: '1234abcd-0000-4000-8000-000000000000', quem: 'Ana Souza', valor: 350, categoria: 'Aula Tênis', produto: false, descricao: null, competencia: '2026-10-10', dataPagamento: '2026-10-28', unidade: 'Boa Bola 1', emitidoEm: new Date('2026-10-29T12:00:00') }

test('recibo de mensalidade: texto simples com dia, valor, competência e forma', () => {
  const r = montarRecibo(base)
  assert.equal(r.numero, '1234ABCD')
  assert.equal(r.texto, 'Recebemos de Ana Souza a quantia de R$ 350,00 (trezentos e cinquenta reais), referente a mensalidade de Aula Tênis, competência 10/26, paga em dinheiro no dia 28 de outubro de 2026.')
  assert.deepEqual(r.linhas.map(l => l[0]), ['Pagador', 'Valor', 'Referente a', 'Forma de pagamento', 'Data do pagamento', 'Unidade'])
})

test('recibo de produto cita o item vendido', () => {
  const r = montarRecibo({ ...base, produto: true, categoria: 'Venda Produto Loja', descricao: 'Venda: ENCORDOAMENTO x1 - Ana Souza', valor: 130, competencia: null })
  assert.match(r.texto, /referente a compra de produto \(ENCORDOAMENTO x1 - Ana Souza\)/)
})

test('a página do recibo traz o logo, o número e escapa o texto', () => {
  const r = montarRecibo({ ...base, quem: '<b>Ana</b> & Cia' })
  const html = htmlDoRecibo(r, 'Boa Bola 1', 'https://exemplo/logo.jpg')
  assert.match(html, /src="https:\/\/exemplo\/logo\.jpg"/)
  assert.match(html, /Nº 1234ABCD/)
  assert.ok(!html.includes('<b>Ana</b>'))
  assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt; &amp; Cia/)
})
