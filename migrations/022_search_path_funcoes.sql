-- Fixa o caminho de busca das funções que ainda não tinham (aviso de segurança do Supabase). APLICADA.
do $do$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('unidade_padrao','esporte_padrao','checar_combo','nome_normalizado','registrar_data_inativacao',
                        '_categoria_estoque','estoque_comprar','estoque_vender','estoque_desfazer_venda','estoque_desfazer_compra')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end $do$;
