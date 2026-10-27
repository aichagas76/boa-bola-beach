-- O pagamento TOTAL que chega do Asaas passa a ser lançado como a baixa manual: uma entrada por matrícula,
-- com categoria, professor, esporte e unidade (combo dividido ao meio), para os relatórios e as comissões
-- baterem nos dois caminhos. Produtos em aberto do aluno são quitados com o que sobrar do valor recebido, e o
-- que ainda sobrar vira uma entrada "outros valores". Tudo numa operação só (pagamento, entradas, produtos e vencimento).
-- As entradas ficam ligadas à cobrança por movimentacoes.pagamento_id (só a primeira leva o id do Asaas, que é único). APLICADA.
alter table public.movimentacoes add column if not exists pagamento_id uuid references public.pagamentos(id) on delete set null;
create index if not exists movimentacoes_pagamento_id on public.movimentacoes (pagamento_id);

create or replace function public.lancar_recebimento_asaas(
  p_pagamento uuid, p_payment_id text, p_valor numeric, p_data date, p_forma text, p_vencimento date
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pg public.pagamentos%rowtype; a public.alunos%rowtype; m record; x record;
  total numeric; restante numeric; metade numeric; prof uuid; cat uuid; outra uuid; esp uuid;
  cat_clubinho uuid; cat_aula uuid; cat_ranking uuid; id_asaas text := p_payment_id; venc date;
  qtd int := 0; prods int := 0;
begin
  select * into pg from public.pagamentos where id = p_pagamento for update;
  if not found then raise exception 'Pagamento não encontrado'; end if;
  select * into a from public.alunos where id = pg.aluno_id for update;

  -- o mesmo aviso chegando duas vezes não lança duas vezes
  if exists (select 1 from public.movimentacoes mv
             where (mv.pagamento_id = p_pagamento or mv.id_cobranca_asaas = p_payment_id)
               and mv.status = 'Recebido' and coalesce(mv.descricao, '') not ilike '%parcial%') then
    return jsonb_build_object('ignorado', 'ja_lancado');
  end if;

  select coalesce(sum(valor), 0) into total from public.matriculas where aluno_id = a.id;
  if total <= 0 then raise exception 'Este aluno não tem matrícula com valor.'; end if;
  venc := coalesce(p_vencimento, a.data_vencimento);
  -- Cobrança com valor combinado menor que a mensalidade (desconto): uma entrada só, como antes, e o vencimento não avança
  if p_valor + 0.009 < total then
    delete from public.movimentacoes where (pagamento_id = p_pagamento or id_cobranca_asaas = p_payment_id) and coalesce(descricao, '') ilike '%parcial%';
    insert into public.movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data, status, aluno_ref_id,
                                      origem, unidade_id, pagamento_id, id_cobranca_asaas)
      values ('Entrada', 'Cobrança Asaas', p_valor, p_forma, p_data, venc, p_data, 'Recebido', a.id, 'Asaas', a.unidade_id, p_pagamento, p_payment_id);
    update public.pagamentos
       set status = 'Pago', data_pagamento = p_data, valor_pago = p_valor, meio_pagamento = p_forma, id_pagamento_asaas = p_payment_id
     where id = p_pagamento;
    return jsonb_build_object('lancamentos', 1, 'produtos', 0, 'sobra', 0, 'desconto', true);
  end if;
  restante := p_valor;

  select id into cat_clubinho from public.categorias_financeiro where categoria = 'Clubinho' and tipo = 'Entrada' and subcategoria is null limit 1;
  select id into cat_aula from public.categorias_financeiro where categoria = 'Aula BT' and tipo = 'Entrada' and subcategoria is null limit 1;
  select id into cat_ranking from public.categorias_financeiro where categoria = 'Ranking' and tipo = 'Entrada' and subcategoria is null limit 1;

  -- um pagamento parcial anterior desta cobrança é substituído pelas entradas completas
  delete from public.movimentacoes where (pagamento_id = p_pagamento or id_cobranca_asaas = p_payment_id) and coalesce(descricao, '') ilike '%parcial%';

  for m in select * from public.matriculas where aluno_id = a.id loop
    prof := coalesce(m.professor_id, (select id from public.professores where nome = m.professor_nome limit 1));
    cat := case m.tipo when 'Clubinho' then cat_clubinho when 'Ranking' then cat_ranking else cat_aula end;
    if m.acesso_duas_unidades then
      select id into outra from public.unidades where id <> coalesce(m.unidade_id, a.unidade_id) and ativo order by codigo limit 1;
      metade := round(m.valor / 2, 2);
      insert into public.movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data, status, aluno_ref_id,
                                        professor_id, origem, categoria_id, unidade_id, esporte_id, pagamento_id, id_cobranca_asaas)
        values ('Entrada', m.tipo || ' (combo, metade)', metade, p_forma, p_data, venc, p_data, 'Recebido', a.id, prof, 'Asaas', cat,
                coalesce(m.unidade_id, a.unidade_id), m.esporte_id, p_pagamento, id_asaas);
      id_asaas := null;
      insert into public.movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data, status, aluno_ref_id,
                                        professor_id, origem, categoria_id, unidade_id, esporte_id, pagamento_id)
        values ('Entrada', m.tipo || ' (combo, metade)', m.valor - metade, p_forma, p_data, venc, p_data, 'Recebido', a.id, prof, 'Asaas', cat,
                coalesce(outra, m.unidade_id, a.unidade_id), m.esporte_id, p_pagamento);
      qtd := qtd + 2;
    else
      insert into public.movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data, status, aluno_ref_id,
                                        professor_id, origem, categoria_id, unidade_id, esporte_id, pagamento_id, id_cobranca_asaas)
        values ('Entrada', m.tipo, m.valor, p_forma, p_data, venc, p_data, 'Recebido', a.id, prof, 'Asaas', cat,
                coalesce(m.unidade_id, a.unidade_id), m.esporte_id, p_pagamento, id_asaas);
      id_asaas := null;
      qtd := qtd + 1;
    end if;
    restante := restante - m.valor;
  end loop;

  -- o que sobrou quita os produtos em aberto do aluno (os mais antigos primeiro, só os que ficam inteiros pagos)
  for x in select id, valor from public.movimentacoes
           where aluno_ref_id = a.id and tipo = 'Entrada' and origem = 'Estoque' and status = 'Não recebido'
           order by data_vencimento, created_at loop
    if x.valor <= restante + 0.005 then
      update public.movimentacoes set status = 'Recebido', data_pagamento = p_data, forma_pagamento = p_forma where id = x.id;
      restante := restante - x.valor;
      prods := prods + 1;
    end if;
  end loop;

  if restante > 0.009 then
    insert into public.movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data, status, aluno_ref_id,
                                      origem, unidade_id, pagamento_id)
      values ('Entrada', 'Cobrança Asaas (outros valores)', round(restante, 2), p_forma, p_data, venc, p_data, 'Recebido', a.id,
              'Asaas', a.unidade_id, p_pagamento);
  end if;

  update public.pagamentos
     set status = 'Pago', data_pagamento = p_data, valor_pago = p_valor, meio_pagamento = p_forma, id_pagamento_asaas = p_payment_id
   where id = p_pagamento;
  update public.alunos set data_vencimento = (a.data_vencimento + interval '1 month')::date where id = a.id and a.data_vencimento is not null;

  return jsonb_build_object('lancamentos', qtd, 'produtos', prods, 'sobra', round(greatest(restante, 0), 2));
end $$;

revoke all on function public.lancar_recebimento_asaas from public, anon, authenticated;
grant execute on function public.lancar_recebimento_asaas to service_role;
