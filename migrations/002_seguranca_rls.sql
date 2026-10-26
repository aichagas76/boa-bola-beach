-- ETAPA 1 (segurança). NÃO APLICADA: aplicar só com autorização do dono.
-- Hoje as tabelas aceitam leitura/escrita de qualquer pessoa na internet (policy "allow all" para
-- o papel public, ou RLS desligado). Aqui só quem está logado (papel authenticated) acessa.
-- As rotas de servidor (webhook, cron, n8n) usam a service role e não são afetadas.
-- Antes de aplicar: conferir que o login do app funciona (usuário em Authentication > Users).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alunos','categorias_financeiro','contas_bancarias','logs',
    'matriculas','movimentacoes','pagamentos','pessoas','professores']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "autenticados" ON public.%I', t);
    EXECUTE format('CREATE POLICY "autenticados" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
