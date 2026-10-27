-- Pagamento do aluno (mensalidade + produtos em aberto) numa operação só: ou entra tudo, ou nada.
-- Também avisa quando o aluno já pagou um ciclo no mesmo dia (evita adiantar o vencimento por clique repetido):
-- a função responde "JA_PAGOU_HOJE" e a tela pede confirmação, repetindo a chamada com p_confirmar_duplicado = true.
-- Roda com as permissões de quem chama (o controle por unidade do banco vale para os produtos). APLICADA.
create or replace function public.baixar_pagamento_aluno(
  p_aluno_id uuid, p_forma text, p_data date, p_valor numeric, p_vencimento date,
  p_produtos uuid[] default '{}', p_receber_mensalidade boolean default true, p_confirmar_duplicado boolean default false
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare a public.alunos%rowtype; resultado jsonb := '{}'::jsonb; qtd_prod int := 0; esperado int := coalesce(array_length(p_produtos, 1), 0);
begin
  select * into a from public.alunos where id = p_aluno_id;
  if not found then raise exception 'Aluno não encontrado'; end if;
  if not p_receber_mensalidade and esperado = 0 then raise exception 'Marque a mensalidade ou algum produto para receber.'; end if;

  if p_receber_mensalidade then
    if not p_confirmar_duplicado and exists (
      select 1 from public.movimentacoes m
      where m.aluno_ref_id = p_aluno_id and m.tipo = 'Entrada' and m.status = 'Recebido'
        and m.origem in ('Manual', 'Asaas') and m.data_pagamento = p_data
        and coalesce(m.descricao, '') not ilike '%parcial%'
    ) then
      raise exception 'JA_PAGOU_HOJE';
    end if;
    -- baixar_pagamento_manual confere a unidade do login e o vencimento; se falhar, nada do que está aqui fica gravado
    resultado := public.baixar_pagamento_manual(p_aluno_id, p_forma, p_data, p_valor, p_vencimento);
  end if;

  if esperado > 0 then
    update public.movimentacoes
       set status = 'Recebido', data_pagamento = p_data, forma_pagamento = p_forma
     where id = any(p_produtos) and aluno_ref_id = p_aluno_id and origem = 'Estoque' and tipo = 'Entrada' and status = 'Não recebido';
    get diagnostics qtd_prod = row_count;
    if qtd_prod <> esperado then
      raise exception 'Algum produto já foi pago ou não é deste aluno. Atualize a tela e confira.';
    end if;
    insert into public.logs (usuario_email, acao, tabela, registro_id, detalhes)
      values (coalesce(auth.jwt() ->> 'email', 'sistema'), 'Baixa de produtos do aluno', 'alunos', a.id::text, a.nome || ' (' || qtd_prod || ' produto(s))');
  end if;

  return resultado || jsonb_build_object('produtos', qtd_prod);
end $$;

revoke all on function public.baixar_pagamento_aluno from public, anon;
grant execute on function public.baixar_pagamento_aluno to authenticated;
