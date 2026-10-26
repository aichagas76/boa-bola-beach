import { test } from 'node:test'
import assert from 'node:assert/strict'
import { situacaoVencimento, vencimentoNoAsaas, jaTemCobranca, diasEntre } from '../lib/cobranca-regras.ts'

const hoje = '2026-10-25'
const limite = '2026-11-04'

test('diasEntre atravessa mês e ano', () => {
  assert.equal(diasEntre('2026-10-10', '2026-10-25'), 15)
  assert.equal(diasEntre('2025-12-31', '2026-01-02'), 2)
})
test('vencimento futuro dentro de 10 dias', () => {
  assert.equal(situacaoVencimento('2026-10-25', hoje, limite), 'futuro')
  assert.equal(situacaoVencimento('2026-11-04', hoje, limite), 'futuro')
})
test('vencimento além da janela fica de fora', () => {
  assert.equal(situacaoVencimento('2026-11-05', hoje, limite), 'fora_da_janela')
})
test('vencimento passado é atrasado (caso real: 10/10)', () => {
  assert.equal(situacaoVencimento('2026-10-10', hoje, limite), 'atrasado')
  assert.equal(situacaoVencimento('2026-10-24', hoje, limite), 'atrasado')
})
test('atraso acima de 90 dias não gera cobrança sozinho', () => {
  assert.equal(situacaoVencimento('2026-07-27', hoje, limite), 'atrasado')
  assert.equal(situacaoVencimento('2026-07-26', hoje, limite), 'atrasado_demais')
})
test('Asaas nunca recebe vencimento no passado', () => {
  assert.equal(vencimentoNoAsaas('2026-10-10', hoje), hoje)
  assert.equal(vencimentoNoAsaas('2026-10-30', hoje), '2026-10-30')
})
test('não duplica: mesmo vencimento já cobrado', () => {
  assert.equal(jaTemCobranca([{ data_vencimento: '2026-10-10', status: 'Pago' }], '2026-10-10', true), true)
})
test('atrasado com outra cobrança em aberto não cria nova', () => {
  assert.equal(jaTemCobranca([{ data_vencimento: '2026-09-10', status: 'Atrasado' }], '2026-10-10', true), true)
})
test('atrasado com cobranças antigas já pagas cria nova', () => {
  assert.equal(jaTemCobranca([{ data_vencimento: '2026-09-10', status: 'Pago' }], '2026-10-10', true), false)
})
test('futuro ignora cobrança aberta de outro mês', () => {
  assert.equal(jaTemCobranca([{ data_vencimento: '2026-09-10', status: 'Pendente' }], '2026-11-01', false), false)
})
