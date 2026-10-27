-- INDICAÇÃO (professor) na venda de produto: o professor que indicou a venda ganha uma comissão de venda,
-- calculada pelo produto vendido (% do valor da venda; o % padrão fica no cadastro do produto e pode ser alterado na venda).
-- A comissão vira uma SAÍDA "A pagar" no Financeiro (Mão de Obra / Comissão de venda), com vencimento no fim do mês.
-- Depende da 025. NÃO APLICADA.
alter table public.estoque_produtos add column if not exists comissao_indicacao numeric(5,2) not null default 0 check (comissao_indicacao >= 0 and comissao_indicacao <= 100);
alter table public.estoque_retiradas add column if not exists indicacao_professor_id uuid references public.professores(id);
alter table public.estoque_retiradas add column if not exists indicacao_movimentacao_id uuid references public.movimentacoes(id) on delete set null;

insert into public.categorias_financeiro (tipo, categoria, subcategoria)
  select 'Saída', 'Mão de Obra', 'Comissão de venda'
  where not exists (select 1 from public.categorias_financeiro where tipo = 'Saída' and categoria = 'Mão de Obra' and subcategoria = 'Comissão de venda');

drop function if exists public.estoque_vender(uuid, integer, text, uuid, uuid, boolean, text, uuid, date, date, uuid, numeric, numeric);

create or replace function public.estoque_vender(
  p_produto uuid, p_quantidade integer, p_comprador text, p_aluno uuid, p_professor uuid,
  p_pago boolean, p_forma text, p_banco uuid, p_vencimento date, p_data date,
  p_comissao_professor uuid, p_comissao_valor numeric, p_preco numeric default null,
  p_indicacao_professor uuid default null, p_indicacao_percentual numeric default null
) returns uuid language plpgsql set search_path = public, pg_temp as $$
declare pr public.estoque_produtos%rowtype; sdo integer; preco numeric; mov uuid; com uuid; ind uuid; ret uuid;
        nome_comprador text; cvalor numeric; pct numeric; total numeric;
begin
  select * into pr from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_comprador not in ('aluno', 'professor') then raise exception 'Comprador inválido'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade'; end if;
  if p_comprador = 'aluno' and p_aluno is null then raise exception 'Escolha o aluno'; end if;
  if p_comprador = 'professor' and p_professor is null then raise exception 'Escolha o professor'; end if;
  if p_preco is not null and p_preco < 0 then raise exception 'Valor inválido'; end if;
  if p_indicacao_percentual is not null and (p_indicacao_percentual < 0 or p_indicacao_percentual > 100) then raise exception 'Porcentagem da indicação inválida'; end if;
  select saldo into sdo from public.estoque_saldos where produto_id = p_produto;
  if p_quantidade > coalesce(sdo, 0) then raise exception 'Estoque insuficiente: restam %', coalesce(sdo, 0); end if;
  preco := coalesce(p_preco, case when p_comprador = 'professor' and pr.preco_professor is not null then pr.preco_professor else pr.preco_aluno end);
  total := round(preco * p_quantidade, 2);
  nome_comprador := case when p_comprador = 'aluno' then (select nome from public.alunos where id = p_aluno)
                         else (select nome from public.professores where id = p_professor) end;

  insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, aluno_ref_id,
      professor_id, banco_id, status, data_vencimento, data_pagamento, origem)
    values (pr.unidade_id, p_data, 'Entrada', public._categoria_estoque('Entrada', 'Venda de Produtos', 'Loja'),
      'Venda: ' || pr.nome || ' x' || p_quantidade || ' - ' || coalesce(nome_comprador, ''), total,
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

  pct := coalesce(p_indicacao_percentual, pr.comissao_indicacao);
  if p_indicacao_professor is not null and pct > 0 and round(total * pct / 100, 2) > 0 then
    insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, professor_id,
        status, data_vencimento, origem)
      values (pr.unidade_id, p_data, 'Saída', public._categoria_estoque('Saída', 'Mão de Obra', 'Comissão de venda'),
        'Comissão de indicação: ' || pr.nome || ' x' || p_quantidade || ' - ' || coalesce(nome_comprador, ''),
        round(total * pct / 100, 2), 'Pix', p_indicacao_professor,
        'Pendente', (date_trunc('month', p_data) + interval '1 month - 1 day')::date, 'Estoque')
      returning id into ind;
  end if;

  insert into public.estoque_retiradas (unidade_id, produto_id, data, quantidade, comprador, aluno_id, professor_id,
      preco_unitario, custo_unitario, movimentacao_id, comissao_movimentacao_id, indicacao_professor_id, indicacao_movimentacao_id)
    values (pr.unidade_id, p_produto, p_data, p_quantidade, p_comprador, p_aluno, p_professor, preco, pr.custo, mov, com,
            case when ind is not null then p_indicacao_professor end, ind)
    returning id into ret;
  return ret;
end $$;

create or replace function public.estoque_desfazer_venda(p_retirada uuid) returns void language plpgsql set search_path = public, pg_temp as $$
declare r public.estoque_retiradas%rowtype;
begin
  select * into r from public.estoque_retiradas where id = p_retirada for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  delete from public.estoque_retiradas where id = p_retirada;
  delete from public.movimentacoes where id in (r.movimentacao_id, r.comissao_movimentacao_id, r.indicacao_movimentacao_id);
end $$;

revoke all on function public.estoque_vender, public.estoque_desfazer_venda from public, anon;
grant execute on function public.estoque_vender, public.estoque_desfazer_venda to authenticated;
