-- PERFIL "GESTORA": só quem é administradora (tabela administradores, a mesma que já gerencia logins) altera
-- os cadastros compartilhados entre as unidades (professores, fornecedores/clientes, bancos, categorias,
-- modalidades) e lê o histórico (Logs). As demais logins continuam usando alunos, financeiro e estoque da
-- própria unidade normalmente e só LEEM esses cadastros. Quem já existe hoje continua administradora.
-- Também ajusta 3 regras que recalculavam o usuário a cada linha (aviso de desempenho do Supabase). NÃO APLICADA.
create or replace function public.eh_gestora() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.administradores where user_id = (select auth.uid()))
$$;
revoke all on function public.eh_gestora() from public, anon;
grant execute on function public.eh_gestora() to authenticated;

do $do$
declare t text;
begin
  foreach t in array array['pessoas', 'professores', 'bancos', 'categorias_financeiro', 'modalidades', 'modalidade_esportes'] loop
    execute format('drop policy if exists "autenticados" on public.%I', t);
    execute format('create policy "todos leem" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "gestora inclui" on public.%I for insert to authenticated with check (public.eh_gestora())', t);
    execute format('create policy "gestora altera" on public.%I for update to authenticated using (public.eh_gestora()) with check (public.eh_gestora())', t);
    execute format('create policy "gestora exclui" on public.%I for delete to authenticated using (public.eh_gestora())', t);
  end loop;
end $do$;

-- Logs: só a gestora lê (os logs misturam as duas unidades); gravar continua liberado, mas só em nome de quem está logado
drop policy if exists "logs leitura" on public.logs;
create policy "logs leitura" on public.logs for select to authenticated using (public.eh_gestora());
drop policy if exists "logs gravar como eu mesmo" on public.logs;
create policy "logs gravar como eu mesmo" on public.logs for insert to authenticated
  with check (usuario_email = (select auth.jwt() ->> 'email'));

drop policy if exists "ver os proprios acessos" on public.acessos;
create policy "ver os proprios acessos" on public.acessos for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "ver o proprio" on public.administradores;
create policy "ver o proprio" on public.administradores for select to authenticated using (user_id = (select auth.uid()));
