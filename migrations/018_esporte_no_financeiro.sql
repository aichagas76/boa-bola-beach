-- Painel: faturamento por professor separado por esporte. Cada entrada do financeiro passa a guardar o esporte.
-- (As entradas de hoje, que são todas de Beach Tênis, são marcadas assim.) NÃO APLICADA.
alter table public.movimentacoes add column if not exists esporte_id uuid references public.esportes(id);
create index if not exists idx_movimentacoes_esporte on public.movimentacoes (esporte_id);
update public.movimentacoes set esporte_id = public.esporte_padrao()
  where esporte_id is null and (professor_id is not null or (tipo = 'Entrada' and aluno_ref_id is not null));

-- A baixa manual passa a gravar o esporte de cada matrícula nas entradas
create or replace function public.baixar_pagamento_manual(
  p_aluno_id uuid, p_forma text, p_data date, p_valor numeric, p_vencimento date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a alunos%rowtype;
  m record;
  total numeric;
  parcial boolean;
  cat_clubinho uuid;
  cat_aula uuid;
  cat_ranking uuid;
  prof uuid;
  outra_unidade uuid;
  metade numeric;
  cat uuid;
  mes_ini date := date_trunc('month', p_data)::date;
  qtd int := 0;
begin
  select * into a from alunos where id = p_aluno_id for update;
  if not found then raise exception 'Aluno não encontrado'; end if;
  if a.unidade_id is null or a.unidade_id not in (select minhas_unidades()) then
    raise exception 'Seu login não tem permissão para lançar pagamento deste aluno.';
  end if;
  if a.data_vencimento is distinct from p_vencimento then
    raise exception 'O vencimento deste aluno mudou (provável pagamento já lançado). Atualize a tela e confira antes de lançar de novo.';
  end if;

  select coalesce(sum(valor), 0) into total from matriculas where aluno_id = p_aluno_id;
  if total <= 0 then raise exception 'Este aluno não tem matrícula com valor.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_valor > total then
    raise exception 'Valor pago não pode ser maior que R$ %', to_char(total, 'FM999990D00');
  end if;
  parcial := p_valor < total;

  select id into cat_clubinho from categorias_financeiro
    where categoria = 'Clubinho' and tipo = 'Entrada' and subcategoria is null limit 1;
  select id into cat_aula from categorias_financeiro
    where categoria = 'Aula BT' and tipo = 'Entrada' and subcategoria is null limit 1;
  select id into cat_ranking from categorias_financeiro
    where categoria = 'Ranking' and tipo = 'Entrada' and subcategoria is null limit 1;

  if parcial then
    insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                               status, aluno_ref_id, origem, categoria_id, unidade_id)
    values ('Entrada', 'Pagamento parcial - ' || a.nome, p_valor, p_forma, p_data, a.data_vencimento, p_data,
            'Recebido', a.id, 'Manual', coalesce(cat_clubinho, cat_aula), a.unidade_id);
    qtd := 1;
  else
    for m in select * from matriculas where aluno_id = p_aluno_id loop
      prof := coalesce(m.professor_id,
                       (select id from professores where nome = m.professor_nome limit 1));
      cat := case m.tipo when 'Clubinho' then cat_clubinho when 'Ranking' then cat_ranking else cat_aula end;

      if m.acesso_duas_unidades then
        -- combo: metade para cada academia
        select id into outra_unidade from unidades where id <> coalesce(m.unidade_id, a.unidade_id) and ativo order by codigo limit 1;
        metade := round(m.valor / 2, 2);
        insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                                   status, aluno_ref_id, professor_id, origem, categoria_id, unidade_id, esporte_id)
        values ('Entrada', m.tipo || ' (combo, metade)', metade, p_forma, p_data, a.data_vencimento, p_data,
                'Recebido', a.id, prof, 'Manual', cat, coalesce(m.unidade_id, a.unidade_id), m.esporte_id);
        insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                                   status, aluno_ref_id, professor_id, origem, categoria_id, unidade_id, esporte_id)
        values ('Entrada', m.tipo || ' (combo, metade)', m.valor - metade, p_forma, p_data, a.data_vencimento, p_data,
                'Recebido', a.id, prof, 'Manual', cat, coalesce(outra_unidade, m.unidade_id, a.unidade_id), m.esporte_id);
        qtd := qtd + 2;
      else
        insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                                   status, aluno_ref_id, professor_id, origem, categoria_id, unidade_id, esporte_id)
        values ('Entrada', m.tipo, m.valor, p_forma, p_data, a.data_vencimento, p_data,
                'Recebido', a.id, prof, 'Manual', cat, coalesce(m.unidade_id, a.unidade_id), m.esporte_id);
        qtd := qtd + 1;
      end if;
    end loop;

    delete from movimentacoes
      where aluno_ref_id = a.id and descricao ilike '%Pagamento parcial%'
        and data_pagamento >= mes_ini and data_pagamento < (mes_ini + interval '1 month');

    update alunos set data_vencimento = (a.data_vencimento + interval '1 month')::date where id = a.id;

    update pagamentos
      set status = 'Pago', data_pagamento = p_data, valor_pago = valor, meio_pagamento = p_forma
      where aluno_id = a.id and status <> 'Pago';
  end if;

  insert into logs (usuario_email, acao, tabela, registro_id, detalhes)
  values (coalesce(auth.jwt() ->> 'email', 'sistema'), 'Pagamento manual', 'alunos', a.id::text,
          a.nome || case when parcial then ' (parcial)' else '' end);

  return jsonb_build_object('parcial', parcial, 'lancamentos', qtd);
end;
$$;

revoke all on function public.baixar_pagamento_manual(uuid, text, date, numeric, date) from public, anon;
grant execute on function public.baixar_pagamento_manual(uuid, text, date, numeric, date) to authenticated;
