-- 034: motivo da inativação do aluno. (1) cadastro simples de motivos (só o nome); (2) o aluno guarda o motivo atual;
--      (3) o histórico de status copia o motivo na hora da inativação, para o gráfico de pizza do Painel. APLICADA em 28/10/2026.

create table if not exists public.motivos_inativacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists motivos_inativacao_nome_unico on public.motivos_inativacao (lower(nome));

alter table public.motivos_inativacao enable row level security;
revoke all on public.motivos_inativacao from anon;
create policy "todos leem" on public.motivos_inativacao for select to authenticated using (true);
create policy "gestora inclui" on public.motivos_inativacao for insert to authenticated with check (public.eh_gestora());
create policy "gestora altera" on public.motivos_inativacao for update to authenticated using (public.eh_gestora()) with check (public.eh_gestora());
create policy "gestora exclui" on public.motivos_inativacao for delete to authenticated using (public.eh_gestora());

-- Ponto de partida (a gestora edita à vontade na tela Motivos de inativação)
insert into public.motivos_inativacao (nome) values
  ('Motivos financeiros'), ('Falta de tempo'), ('Mudança de cidade/bairro'), ('Lesão ou saúde'),
  ('Insatisfação com as aulas'), ('Desistiu do esporte'), ('Outro')
on conflict do nothing;

alter table public.alunos add column if not exists motivo_inativacao_id uuid references public.motivos_inativacao(id) on delete set null;
alter table public.alunos_status_historico add column if not exists motivo_id uuid references public.motivos_inativacao(id) on delete set null;
create index if not exists idx_alunos_motivo_inativacao on public.alunos (motivo_inativacao_id);
create index if not exists idx_status_hist_motivo on public.alunos_status_historico (motivo_id);

-- Voltou a ficar ativo: o motivo deixa de valer (fica só no histórico)
create or replace function public.registrar_data_inativacao() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'Inativo' and (tg_op = 'INSERT' or old.status is distinct from 'Inativo') then
    new.data_inativacao := (now() at time zone 'America/Sao_Paulo')::date;
  elsif new.status is distinct from 'Inativo' then
    new.data_inativacao := null;
    new.motivo_inativacao_id := null;
  end if;
  return new;
end $$;

create or replace function public.registrar_historico_status() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    insert into public.alunos_status_historico (aluno_id, de_status, para_status, data, motivo_id)
    values (new.id, old.status, new.status, (now() at time zone 'America/Sao_Paulo')::date,
            case when new.status = 'Inativo' then new.motivo_inativacao_id end);
  end if;
  return new;
end $$;
revoke all on function public.registrar_historico_status() from public, anon, authenticated;
