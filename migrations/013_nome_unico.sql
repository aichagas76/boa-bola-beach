-- Regra do dono: CPF pode se repetir (ex.: pai/mãe pagando por mais de um aluno), NOME NÃO.
-- O banco passa a recusar 2 alunos com o mesmo nome (sem diferenciar maiúsculas, acentos e espaços extras),
-- em qualquer unidade. Conferido antes: hoje não há nomes repetidos. NÃO APLICADA.
create or replace function public.nome_normalizado(n text) returns text language sql immutable as $$
  select lower(trim(regexp_replace(
    translate(coalesce(n, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'),
    '\s+', ' ', 'g')))
$$;

create unique index if not exists alunos_nome_unico on public.alunos (public.nome_normalizado(nome));

-- Pergunta usada pelo cadastro (vale para todas as unidades, devolve só sim/não)
create or replace function public.nome_ja_cadastrado(p_nome text, p_ignorar uuid default null) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.nome_normalizado(p_nome) <> '' and exists (
    select 1 from public.alunos a
    where public.nome_normalizado(a.nome) = public.nome_normalizado(p_nome)
      and (p_ignorar is null or a.id <> p_ignorar))
$$;
revoke all on function public.nome_ja_cadastrado(text, uuid) from public, anon;
grant execute on function public.nome_ja_cadastrado(text, uuid) to authenticated;

-- A checagem de CPF repetido deixa de existir
drop function if exists public.cpf_ja_cadastrado(text, uuid);
