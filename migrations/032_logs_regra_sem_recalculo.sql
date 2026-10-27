-- Última regra de acesso que o Supabase apontava como lenta: a de gravar logs consultava o usuário a cada linha.
-- Agora consulta uma vez só. Mesmo efeito: cada login só grava log em nome do próprio e-mail. APLICADA.
drop policy if exists "logs gravar como eu mesmo" on public.logs;
create policy "logs gravar como eu mesmo" on public.logs for insert to authenticated
  with check (usuario_email = ((select auth.jwt()) ->> 'email'));
