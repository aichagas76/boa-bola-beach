-- 033: (1) esportes de cada professor, para o cadastro de aluno mostrar só os professores do esporte;
--      (2) histórico de mudança de status do aluno (ativo -> inativo e inativo -> ativo), para os gráficos de
--          inativações e reativações do Painel. APLICADA em 27/10/2026.

-- ============ (1) professor x esporte ============
create table if not exists public.professor_esportes (
  professor_id uuid not null references public.professores(id) on delete cascade,
  esporte_id   uuid not null references public.esportes(id) on delete cascade,
  primary key (professor_id, esporte_id)
);
create index if not exists idx_professor_esportes_esporte on public.professor_esportes (esporte_id);

alter table public.professor_esportes enable row level security;
revoke all on public.professor_esportes from anon;
-- mesma regra dos outros cadastros compartilhados: todos leem, só a gestora altera
create policy "todos leem" on public.professor_esportes for select to authenticated using (true);
create policy "gestora inclui" on public.professor_esportes for insert to authenticated with check (public.eh_gestora());
create policy "gestora exclui" on public.professor_esportes for delete to authenticated using (public.eh_gestora());

-- Ponto de partida: o esporte em que cada professor já dá aula hoje (pelas matrículas). A gestora ajusta depois.
insert into public.professor_esportes (professor_id, esporte_id)
select distinct p.id, m.esporte_id
from public.matriculas m
join public.professores p on p.id = m.professor_id or (m.professor_id is null and lower(p.nome) = lower(m.professor_nome))
where m.esporte_id is not null
on conflict do nothing;

-- ============ (2) histórico de status do aluno ============
create table if not exists public.alunos_status_historico (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  de_status text,
  para_status text not null,
  data date not null,
  estimado boolean not null default false, -- true = data estimada pelo último pagamento (alunos importados, sem data de saída)
  created_at timestamptz not null default now()
);
create index if not exists idx_status_hist_aluno on public.alunos_status_historico (aluno_id);
create index if not exists idx_status_hist_data on public.alunos_status_historico (para_status, data);

alter table public.alunos_status_historico enable row level security;
revoke all on public.alunos_status_historico from anon;
create policy "ve o historico do aluno visivel" on public.alunos_status_historico for select to authenticated using (public.aluno_visivel(aluno_id));
-- ninguém grava direto: só o gatilho abaixo

create or replace function public.registrar_historico_status() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    insert into public.alunos_status_historico (aluno_id, de_status, para_status, data)
    values (new.id, old.status, new.status, (now() at time zone 'America/Sao_Paulo')::date);
  end if;
  return new;
end $$;
revoke all on function public.registrar_historico_status() from public, anon, authenticated;

drop trigger if exists alunos_historico_status on public.alunos;
create trigger alunos_historico_status after update of status on public.alunos
  for each row execute function public.registrar_historico_status();

-- Alunos que já estão inativos e não têm data de saída: estima pela data do último pagamento recebido
insert into public.alunos_status_historico (aluno_id, de_status, para_status, data, estimado)
select a.id, 'Ativo', 'Inativo', max(coalesce(m.data_pagamento, m.data)), true
from public.alunos a
join public.movimentacoes m on m.aluno_ref_id = a.id and m.tipo = 'Entrada' and m.status = 'Recebido'
where a.status = 'Inativo'
  and not exists (select 1 from public.alunos_status_historico h where h.aluno_id = a.id)
group by a.id;
