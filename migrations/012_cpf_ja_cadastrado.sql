-- ETAPA 5: o cadastro avisa quando o CPF já existe em QUALQUER unidade, sem revelar de quem é.
-- (security definer: enxerga todas as unidades, mas devolve só sim/não.) NÃO APLICADA.
create or replace function public.cpf_ja_cadastrado(p_cpf text, p_ignorar uuid default null) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.alunos a
    where regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
      and regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') <> ''
      and (p_ignorar is null or a.id <> p_ignorar))
$$;
revoke all on function public.cpf_ja_cadastrado(text, uuid) from public, anon;
grant execute on function public.cpf_ja_cadastrado(text, uuid) to authenticated;
