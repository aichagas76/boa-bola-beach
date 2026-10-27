-- O valor da venda do estoque passa a poder ser alterado na hora (o preço do produto continua sendo o padrão).
-- A função ganha o parâmetro p_preco (preço de cada unidade); sem ele, vale o preço do produto como antes. NÃO APLICADA.
drop function if exists public.estoque_vender(uuid, integer, text, uuid, uuid, boolean, text, uuid, date, date, uuid, numeric);

create or replace function public.estoque_vender(
  p_produto uuid, p_quantidade integer, p_comprador text, p_aluno uuid, p_professor uuid,
  p_pago boolean, p_forma text, p_banco uuid, p_vencimento date, p_data date,
  p_comissao_professor uuid, p_comissao_valor numeric, p_preco numeric default null
) returns uuid language plpgsql set search_path = public, pg_temp as $$
declare pr public.estoque_produtos%rowtype; sdo integer; preco numeric; mov uuid; com uuid; ret uuid; nome_comprador text; cvalor numeric;
begin
  select * into pr from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_comprador not in ('aluno', 'professor') then raise exception 'Comprador inválido'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade'; end if;
  if p_comprador = 'aluno' and p_aluno is null then raise exception 'Escolha o aluno'; end if;
  if p_comprador = 'professor' and p_professor is null then raise exception 'Escolha o professor'; end if;
  if p_preco is not null and p_preco < 0 then raise exception 'Valor inválido'; end if;
  select saldo into sdo from public.estoque_saldos where produto_id = p_produto;
  if p_quantidade > coalesce(sdo, 0) then raise exception 'Estoque insuficiente: restam %', coalesce(sdo, 0); end if;
  preco := coalesce(p_preco, case when p_comprador = 'professor' and pr.preco_professor is not null then pr.preco_professor else pr.preco_aluno end);
  nome_comprador := case when p_comprador = 'aluno' then (select nome from public.alunos where id = p_aluno)
                         else (select nome from public.professores where id = p_professor) end;

  insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, aluno_ref_id,
      professor_id, banco_id, status, data_vencimento, data_pagamento, origem)
    values (pr.unidade_id, p_data, 'Entrada', public._categoria_estoque('Entrada', 'Venda de Produtos', 'Loja'),
      'Venda: ' || pr.nome || ' x' || p_quantidade || ' - ' || coalesce(nome_comprador, ''), round(preco * p_quantidade, 2),
      coalesce(p_forma, 'Pix'), p_aluno, p_professor, case when p_pago then p_banco end,
      case when p_pago then 'Recebido' else 'Não recebido' end,
      case when p_pago then p_data else coalesce(p_vencimento, p_data) end,
      case when p_pago then p_data end, 'Estoque')
    returning id into mov;

  cvalor := coalesce(p_comissao_valor, pr.comissao_valor);
  if pr.encordoamento and cvalor > 0 and coalesce(p_comissao_professor, pr.comissao_professor_id) is not null then
    insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, professor_id,
        esporte_id, status, data_vencimento, data_pagamento, origem)
      values (pr.unidade_id, p_data, 'Saída', public._categoria_estoque('Saída', 'Mão de Obra', 'Comissão de encordoamento'),
        'Comissão de encordoamento: ' || pr.nome || ' x' || p_quantidade, round(cvalor * p_quantidade, 2), 'Pix',
        coalesce(p_comissao_professor, pr.comissao_professor_id), (select id from public.esportes where nome = 'Tênis' limit 1),
        'Pago', p_data, p_data, 'Estoque')
      returning id into com;
  end if;

  insert into public.estoque_retiradas (unidade_id, produto_id, data, quantidade, comprador, aluno_id, professor_id,
      preco_unitario, custo_unitario, movimentacao_id, comissao_movimentacao_id)
    values (pr.unidade_id, p_produto, p_data, p_quantidade, p_comprador, p_aluno, p_professor, preco, pr.custo, mov, com)
    returning id into ret;
  return ret;
end $$;

revoke all on function public.estoque_vender from public, anon;
grant execute on function public.estoque_vender to authenticated;
