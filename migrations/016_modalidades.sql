-- Cadastro de Modalidades (só o nome + ativo). Modalidade inativa não aparece no cadastro do aluno
-- (as matrículas que o aluno já tem nela continuam guardadas, só ficam escondidas). NÃO APLICADA.
create table if not exists public.modalidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists modalidades_nome_unico on public.modalidades (lower(trim(nome)));

-- 'Aula' é o nome que as matrículas já usam; no cadastro do aluno aparece como "Aulas"
insert into public.modalidades (nome) values ('Clubinho'), ('Aula'), ('Ranking') on conflict do nothing;

alter table public.modalidades enable row level security;
create policy "autenticados" on public.modalidades for all to authenticated using (true) with check (true);
revoke all on public.modalidades from anon;
revoke truncate, references, trigger on public.modalidades from authenticated;

-- Matrícula passa a aceitar qualquer modalidade cadastrada (antes só Clubinho/Aula/Ranking)
alter table public.matriculas drop constraint if exists matriculas_tipo_check;
