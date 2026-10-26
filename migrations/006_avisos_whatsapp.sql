-- ETAPA 3 / item 4: controle dos avisos de WhatsApp por cobrança + tipo de aviso, com contagem de tentativas.
-- Antes: 4 colunas em "alunos" (SIM/NAO/ERRO); um ERRO nunca era retentado e o ciclo era zerado pelo cron.
-- NÃO APLICADA. Só o servidor (service role) grava; quem está logado só lê.
create table if not exists public.avisos_whatsapp (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  tipo text not null check (tipo in ('3dias','vencimento','3diasAtraso','6diasAtraso')),
  resultado text not null check (resultado in ('SIM','ERRO')),
  tentativas int not null default 1,
  ultimo_erro text,
  atualizado_em timestamptz not null default now(),
  unique (pagamento_id, tipo)
);
alter table public.avisos_whatsapp enable row level security;
create policy "autenticados leem" on public.avisos_whatsapp for select to authenticated using (true);
revoke all on public.avisos_whatsapp from anon;
