-- ETAPA 5: cada login enxerga só a(s) unidade(s) a que tem acesso (Boa Bola 1 e/ou 2), tudo no mesmo banco.
-- Aluno que treina nas duas unidades (matrícula em outra unidade ou combo) aparece para as duas, para consulta.
-- Depende da 008. NÃO APLICADA. Atenção: o(s) usuário(s) que já existem recebem acesso às DUAS unidades
-- logo abaixo, para ninguém ficar trancado para fora.

create table if not exists public.acessos (
  user_id uuid not null references auth.users(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  primary key (user_id, unidade_id)
);
alter table public.acessos enable row level security;
create policy "ver os proprios acessos" on public.acessos for select to authenticated using (user_id = auth.uid());
revoke all on public.acessos from anon;
revoke insert, update, delete, truncate, references, trigger on public.acessos from authenticated;

-- Quem já existe hoje (a dona) vê as duas unidades
insert into public.acessos (user_id, unidade_id)
  select u.id, un.id from auth.users u cross join public.unidades un
  on conflict do nothing;

-- Funções com privilégio de dono do banco (evitam laço entre as regras de alunos e matrículas)
create or replace function public.minhas_unidades() returns setof uuid
  language sql stable security definer set search_path = public as
  $$ select unidade_id from public.acessos where user_id = auth.uid() $$;

create or replace function public.aluno_visivel(aid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.alunos a where a.id = aid and a.unidade_id in (select public.minhas_unidades()))
      or exists (select 1 from public.matriculas m where m.aluno_id = aid and m.unidade_id in (select public.minhas_unidades()))
$$;
revoke all on function public.minhas_unidades(), public.aluno_visivel(uuid) from public, anon;
grant execute on function public.minhas_unidades(), public.aluno_visivel(uuid) to authenticated;

-- Financeiro e contas passam a ter unidade (o que já existe fica na Boa Bola 2)
alter table public.movimentacoes add column if not exists unidade_id uuid references public.unidades(id) default public.unidade_padrao();
update public.movimentacoes mv set unidade_id = coalesce(
  (select a.unidade_id from public.alunos a where a.id = mv.aluno_ref_id), public.unidade_padrao()) where unidade_id is null;
alter table public.contas_bancarias add column if not exists unidade_id uuid references public.unidades(id) default public.unidade_padrao();
update public.contas_bancarias set unidade_id = public.unidade_padrao() where unidade_id is null;

-- Regras novas (substituem o "qualquer logado vê tudo")
drop policy if exists "autenticados" on public.alunos;
create policy "alunos da minha unidade" on public.alunos for select to authenticated using (public.aluno_visivel(id));
create policy "criar aluno na minha unidade" on public.alunos for insert to authenticated
  with check (unidade_id in (select public.minhas_unidades()));
create policy "editar aluno da minha unidade" on public.alunos for update to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));
create policy "excluir aluno da minha unidade" on public.alunos for delete to authenticated
  using (unidade_id in (select public.minhas_unidades()));

drop policy if exists "autenticados" on public.matriculas;
create policy "matriculas visiveis" on public.matriculas for select to authenticated using (public.aluno_visivel(aluno_id));
create policy "matriculas gravar" on public.matriculas for insert to authenticated
  with check (public.aluno_visivel(aluno_id) and unidade_id in (select public.minhas_unidades()));
create policy "matriculas alterar" on public.matriculas for update to authenticated
  using (public.aluno_visivel(aluno_id)) with check (unidade_id in (select public.minhas_unidades()));
create policy "matriculas apagar" on public.matriculas for delete to authenticated using (public.aluno_visivel(aluno_id));

drop policy if exists "autenticados" on public.pagamentos;
create policy "pagamentos do aluno visivel" on public.pagamentos for all to authenticated
  using (public.aluno_visivel(aluno_id)) with check (public.aluno_visivel(aluno_id));

drop policy if exists "autenticados" on public.movimentacoes;
create policy "movimentacoes da minha unidade" on public.movimentacoes for all to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));

drop policy if exists "autenticados" on public.contas_bancarias;
create policy "contas da minha unidade" on public.contas_bancarias for all to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));

drop policy if exists "autenticados leem" on public.avisos_whatsapp;
create policy "avisos do aluno visivel" on public.avisos_whatsapp for select to authenticated using (public.aluno_visivel(aluno_id));

-- Compartilhados entre as unidades (continuam como estão): categorias_financeiro, pessoas, professores, logs

-- Quem tem acesso a UMA só unidade grava tudo (aluno, financeiro, conta) nela sem precisar escolher;
-- quem tem as duas (a dona) cai na Boa Bola 2 enquanto a tela não escolher.
create or replace function public.unidade_padrao() returns uuid language sql stable as $$
  select coalesce(
    (select (array_agg(unidade_id))[1] from public.acessos where user_id = auth.uid() having count(*) = 1),
    (select id from public.unidades where codigo = 'bb2'))
$$;
