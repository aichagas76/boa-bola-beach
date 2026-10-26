-- ETAPA 5: Boa Bola 1 e 2, esportes (Tênis, Beach Tênis, Pickleball, Padel) e modalidades (Clubinho, Aula, Ranking).
-- Aditiva e compatível: tudo que já existe vira "Boa Bola 2 / Beach Tênis"; telas antigas continuam gravando
-- (os padrões abaixo preenchem unidade e esporte sozinhos). NÃO APLICADA.

create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true
);
create table if not exists public.esportes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true
);
insert into public.unidades (codigo, nome) values ('bb1', 'Boa Bola 1'), ('bb2', 'Boa Bola 2') on conflict do nothing;
insert into public.esportes (nome) values ('Tênis'), ('Beach Tênis'), ('Pickleball'), ('Padel') on conflict do nothing;

alter table public.unidades enable row level security;
alter table public.esportes enable row level security;
create policy "autenticados leem" on public.unidades for select to authenticated using (true);
create policy "autenticados leem" on public.esportes for select to authenticated using (true);
revoke all on public.unidades, public.esportes from anon;
revoke truncate, references, trigger on public.unidades, public.esportes from authenticated;

create or replace function public.unidade_padrao() returns uuid language sql stable as
  $$ select id from public.unidades where codigo = 'bb2' $$;
create or replace function public.esporte_padrao() returns uuid language sql stable as
  $$ select id from public.esportes where nome = 'Beach Tênis' $$;

-- Unidade principal do aluno (é por ela que a cobrança sai)
alter table public.alunos add column if not exists unidade_id uuid references public.unidades(id) default public.unidade_padrao();
update public.alunos set unidade_id = public.unidade_padrao() where unidade_id is null;

-- Cada matrícula passa a dizer o esporte, a unidade onde acontece e se o Clubinho vale nas duas unidades (combo)
alter table public.matriculas add column if not exists esporte_id uuid references public.esportes(id) default public.esporte_padrao();
alter table public.matriculas add column if not exists unidade_id uuid references public.unidades(id) default public.unidade_padrao();
alter table public.matriculas add column if not exists acesso_duas_unidades boolean not null default false;
update public.matriculas set esporte_id = public.esporte_padrao() where esporte_id is null;
update public.matriculas set unidade_id = public.unidade_padrao() where unidade_id is null;

alter table public.matriculas drop constraint if exists matriculas_tipo_check;
alter table public.matriculas add constraint matriculas_tipo_check check (tipo in ('Clubinho','Aula','Ranking'));

-- Combo (Clubinho nas duas unidades) só existe para Clubinho de Beach Tênis
create or replace function public.checar_combo() returns trigger language plpgsql as $$
begin
  if new.acesso_duas_unidades and not (
       new.tipo = 'Clubinho'
       and new.esporte_id = (select id from public.esportes where nome = 'Beach Tênis')) then
    raise exception 'O combo (duas unidades) só vale para Clubinho de Beach Tênis.';
  end if;
  return new;
end $$;
drop trigger if exists matriculas_checar_combo on public.matriculas;
create trigger matriculas_checar_combo before insert or update on public.matriculas
  for each row execute function public.checar_combo();

create index if not exists idx_matriculas_esporte on public.matriculas (esporte_id);
create index if not exists idx_alunos_unidade on public.alunos (unidade_id);
