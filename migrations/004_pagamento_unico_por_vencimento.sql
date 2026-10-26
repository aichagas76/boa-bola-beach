-- ETAPA 2 / item 2: o banco passa a recusar 2 cobranças do mesmo aluno para o mesmo vencimento.
-- NÃO APLICADA. Antes é preciso apagar os 3 duplicados de teste (valor R$ 5,00) do aluno 70db8b5a-...:
--   305bf1f5-b72f-4c32-8f05-debba6f23a9d  (venc. 10/11, sem cobrança Asaas)
--   b3c9756b-8ea2-4751-824c-e760d47e10c9  (venc. 10/11, sem cobrança Asaas)
--   c2a05577-22c0-458a-8acd-10553e844202  (venc. 20/10, cobrança pay_ns3j... sem valor pago)
-- Ficam: 201da25a (10/11) e eb6701f6 (20/10), ambas com cobrança Asaas paga.
delete from public.pagamentos where id in (
  '305bf1f5-b72f-4c32-8f05-debba6f23a9d',
  'b3c9756b-8ea2-4751-824c-e760d47e10c9',
  'c2a05577-22c0-458a-8acd-10553e844202');

create unique index if not exists pagamentos_unico_aluno_vencimento
  on public.pagamentos (aluno_id, data_vencimento)
  where status <> 'Cancelado';
