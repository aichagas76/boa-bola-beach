-- ETAPA 4 / item 5: o registro de ações (logs) deixa de poder ser forjado ou apagado por quem está logado.
-- Antes: qualquer usuário logado podia gravar um log com o e-mail de outra pessoa, alterar e apagar logs.
-- Agora: só grava com o PRÓPRIO e-mail (vindo do login, não do navegador) e nunca altera/apaga.
-- Também tira de quem está logado o poder de TRUNCATE/REFERENCES/TRIGGER nas tabelas (o RLS não protege contra TRUNCATE).
drop policy if exists "autenticados" on public.logs;
create policy "logs leitura" on public.logs for select to authenticated using (true);
create policy "logs gravar como eu mesmo" on public.logs for insert to authenticated
  with check (usuario_email = (auth.jwt() ->> 'email'));
revoke update, delete, truncate, references, trigger on public.logs from authenticated;

do $$
declare t text;
begin
  foreach t in array array['alunos','categorias_financeiro','contas_bancarias','matriculas',
                           'movimentacoes','pagamentos','pessoas','professores','avisos_whatsapp']
  loop
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;
