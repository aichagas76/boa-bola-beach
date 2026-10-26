-- Cada modalidade passa a dizer em QUAIS ESPORTES vale (ex.: Clubinho não existe no Tênis).
-- No cadastro do aluno, cada esporte mostra só as modalidades ativas que valem para ele.
-- As matrículas que já existem não são tocadas (o que ficar escondido continua guardado). NÃO APLICADA.
create table if not exists public.modalidade_esportes (
  modalidade_id uuid not null references public.modalidades(id) on delete cascade,
  esporte_id uuid not null references public.esportes(id) on delete cascade,
  primary key (modalidade_id, esporte_id)
);
alter table public.modalidade_esportes enable row level security;
create policy "autenticados" on public.modalidade_esportes for all to authenticated using (true) with check (true);
revoke all on public.modalidade_esportes from anon;
revoke truncate, references, trigger on public.modalidade_esportes from authenticated;

-- Ponto de partida: toda modalidade vale para todo esporte, menos Clubinho no Tênis
insert into public.modalidade_esportes (modalidade_id, esporte_id)
  select m.id, e.id from public.modalidades m cross join public.esportes e
  where not (m.nome = 'Clubinho' and e.nome = 'Tênis')
on conflict do nothing;
