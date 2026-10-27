-- DADOS OBRIGATÓRIOS NO BANCO: o banco passa a recusar lançamentos incompletos ou contraditórios, em vez de
-- deixar a tela decidir sozinha. Regras novas (movimentacoes): tipo e status só os conhecidos (inclui "Estornado"),
-- vencimento obrigatório, valor maior que zero, categoria obrigatória (exceto entradas vindas do Asaas),
-- "Recebido/Pago" exige data de pagamento e "Não recebido/Pendente" não pode ter data de pagamento.
-- Também: matrícula sem valor negativo e status de pagamento só os conhecidos.
-- As regras de valor, vencimento e data de baixa entram como NOT VALID: valem para o que for gravado/alterado de agora em diante;
-- os 5 lançamentos de TESTE antigos que já as violam continuam como estão até você corrigi-los (depois disso: ver o fim deste arquivo).
-- Compra do estoque com custo zero não lança mais uma saída de R$ 0,00 no Financeiro. APLICADA.
alter table public.movimentacoes add constraint mov_tipo_valido check (tipo in ('Entrada', 'Saída'));
alter table public.movimentacoes add constraint mov_status_valido check (status in ('Recebido', 'Pago', 'Não recebido', 'Pendente', 'Estornado'));
alter table public.movimentacoes add constraint mov_categoria_obrigatoria check (categoria_id is not null or origem = 'Asaas');
alter table public.movimentacoes add constraint mov_aberto_sem_data_pagamento check (status not in ('Não recebido', 'Pendente') or data_pagamento is null);
alter table public.movimentacoes add constraint mov_valor_positivo check (valor > 0) not valid;
alter table public.movimentacoes add constraint mov_vencimento_obrigatorio check (data_vencimento is not null) not valid;
alter table public.movimentacoes add constraint mov_baixa_com_data_pagamento check (status not in ('Recebido', 'Pago') or data_pagamento is not null) not valid;
alter table public.matriculas add constraint matricula_valor_nao_negativo check (valor >= 0);
alter table public.pagamentos add constraint pagamento_status_valido check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado'));

create or replace function public.estoque_comprar(
  p_produto uuid, p_quantidade integer, p_custo numeric, p_fornecedor uuid, p_data date,
  p_lancar boolean, p_forma text, p_banco uuid
) returns uuid language plpgsql set search_path = public, pg_temp as $$
declare pr public.estoque_produtos%rowtype; mov uuid;
begin
  select * into pr from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade'; end if;
  if p_custo is null or p_custo < 0 then raise exception 'Informe o custo'; end if;
  if p_lancar and round(p_custo * p_quantidade, 2) > 0 then
    insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, pessoa_id,
        banco_id, status, data_vencimento, data_pagamento, origem)
      values (pr.unidade_id, p_data, 'Saída', public._categoria_estoque('Saída', 'Compra de Produtos', 'Estoque'),
        'Compra: ' || pr.nome || ' x' || p_quantidade, round(p_custo * p_quantidade, 2), coalesce(p_forma, 'Pix'),
        p_fornecedor, p_banco, 'Pago', p_data, p_data, 'Estoque')
      returning id into mov;
  end if;
  insert into public.estoque_compras (unidade_id, produto_id, data, quantidade, custo_unitario, fornecedor_id, movimentacao_id)
    values (pr.unidade_id, p_produto, p_data, p_quantidade, p_custo, p_fornecedor, mov);
  update public.estoque_produtos set custo = p_custo, fornecedor_id = coalesce(p_fornecedor, fornecedor_id) where id = p_produto;
  return mov;
end $$;

-- Depois de corrigir ou apagar os lançamentos de teste antigos, validar tudo de uma vez:
--   alter table public.movimentacoes validate constraint mov_valor_positivo;
--   alter table public.movimentacoes validate constraint mov_vencimento_obrigatorio;
--   alter table public.movimentacoes validate constraint mov_baixa_com_data_pagamento;
