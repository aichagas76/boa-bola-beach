-- ETAPA 2 / item 3: o banco passa a recusar 2 entradas para a mesma cobrança do Asaas
-- (protege contra o mesmo aviso de pagamento chegando duas vezes ao mesmo tempo).
-- Conferido antes: hoje há 1 entrada do Asaas e nenhuma repetida.
create unique index if not exists movimentacoes_unica_cobranca_asaas
  on public.movimentacoes (id_cobranca_asaas)
  where id_cobranca_asaas is not null;
