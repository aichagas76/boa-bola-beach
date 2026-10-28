# De onde vêm os números de dinheiro (fonte única)

Atualizado em 28/10/2026.

## Regra

**Todo dinheiro que entrou ou saiu está na tabela `movimentacoes` (tela Financeiro).** Painel, Fluxo de caixa,
Relatórios, Em atraso e Estoque leem dela. Entrada = `tipo 'Entrada'`, saída = `tipo 'Saída'`.
Pago/recebido = `status 'Pago'` ou `'Recebido'`; a data que vale é `data_pagamento` (ou `data`, se não houver).

## O que é a tabela `pagamentos`

Não guarda dinheiro. É só o **registro da cobrança enviada pelo Asaas** (link, id da cobrança, vencimento, status da
cobrança). Quando a cobrança é paga, o webhook do Asaas (`/api/webhooks/asaas`) e a baixa manual do aluno gravam uma
`movimentacoes` de entrada ligada a ela por `movimentacoes.pagamento_id`.

Por isso `pagamentos` tem poucas linhas (hoje 1, de teste): o histórico de 2026 veio da planilha antiga direto para
`movimentacoes`.

## O que cada tela usa

| Tela / cálculo | Fonte |
|---|---|
| Receita recebida, lucro, fluxo de caixa, despesas por categoria | `movimentacoes` |
| Em atraso (alunos inadimplentes) | `alunos.data_vencimento` + entradas em aberto em `movimentacoes` + cobranças abertas em `pagamentos` |
| Pagamento dos professores | `matriculas` + entradas recebidas em `movimentacoes` + comissões e vales em `movimentacoes` |
| Vendas de produtos | `movimentacoes` (categoria "Venda Produto Loja") |
| Link/PIX de cobrança de um aluno | `pagamentos` |

## Regras para mexer no código

1. Valor, status e data de dinheiro: **sempre de `movimentacoes`**.
2. `pagamentos` só para o que é da cobrança (link, id no Asaas, vencimento da cobrança em aberto).
3. Não somar `pagamentos` com `movimentacoes` (conta em dobro): a função `itensFinanceiros` (`lib/painel.ts`) já ignora os
   `pagamentos` com status "Pago" porque o dinheiro deles está nas entradas.
4. Lançamento novo de dinheiro (venda, mensalidade, despesa) entra por `movimentacoes`, nunca direto em `pagamentos`.
