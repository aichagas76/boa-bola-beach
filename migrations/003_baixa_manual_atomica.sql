-- ETAPA 2 / item 2: baixa manual de mensalidade em UMA operação só (tudo ou nada).
-- Antes, a tela fazia 3 a 4 gravações soltas pelo navegador; se uma falhasse, o caixa
-- e o vencimento do aluno ficavam inconsistentes. NÃO APLICADA ainda.
create or replace function public.baixar_pagamento_manual(
  p_aluno_id uuid,
  p_forma text,
  p_data date,
  p_valor numeric,
  p_vencimento date  -- vencimento que a tela mostrava; protege contra clique duplo / tela velha
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  a alunos%rowtype;
  m record;
  total numeric;
  parcial boolean;
  cat_clubinho uuid;
  cat_aula uuid;
  prof uuid;
  mes_ini date := date_trunc('month', p_data)::date;
  qtd int := 0;
begin
  select * into a from alunos where id = p_aluno_id for update;  -- trava: 2 baixas ao mesmo tempo esperam na fila
  if not found then raise exception 'Aluno não encontrado'; end if;
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

  if parcial then
    insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                               status, aluno_ref_id, origem, categoria_id)
    values ('Entrada', 'Pagamento parcial - ' || a.nome, p_valor, p_forma, p_data, a.data_vencimento, p_data,
            'Recebido', a.id, 'Manual', coalesce(cat_clubinho, cat_aula));
    qtd := 1;
  else
    for m in select * from matriculas where aluno_id = p_aluno_id loop
      prof := coalesce(m.professor_id,
                       (select id from professores where nome = m.professor_nome limit 1));
      insert into movimentacoes (tipo, descricao, valor, forma_pagamento, data_pagamento, data_vencimento, data,
                                 status, aluno_ref_id, professor_id, origem, categoria_id)
      values ('Entrada', case when m.tipo = 'Clubinho' then 'Clubinho' else 'Aula' end, m.valor, p_forma,
              p_data, a.data_vencimento, p_data, 'Recebido', a.id, prof, 'Manual',
              case when m.tipo = 'Clubinho' then cat_clubinho else cat_aula end);
      qtd := qtd + 1;
    end loop;

    -- o total já foi pago: apaga os lançamentos parciais do mês
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
