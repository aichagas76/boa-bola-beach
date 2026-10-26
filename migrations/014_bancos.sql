-- Cadastro de Bancos (só o nome) e o campo Banco nas movimentações do financeiro.
-- A lista é única para as duas unidades (é só o nome do banco). NÃO APLICADA.
create table if not exists public.bancos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists bancos_nome_unico on public.bancos (lower(trim(nome)));

alter table public.bancos enable row level security;
create policy "autenticados" on public.bancos for all to authenticated using (true) with check (true);
revoke all on public.bancos from anon;
revoke truncate, references, trigger on public.bancos from authenticated;

alter table public.movimentacoes add column if not exists banco_id uuid references public.bancos(id) on delete set null;
create index if not exists idx_movimentacoes_banco on public.movimentacoes (banco_id);
