-- O estoque passa a usar as categorias que já existem no plano de contas, em vez de criar duplicadas:
--   venda    -> Entrada: Venda Produto Loja / Outros
--   compra   -> Saída:   Compra Produto Loja / Outros
--   comissão -> Saída:   Mão de Obra / Comissão de encordoamento (já existia)
-- Os lançamentos feitos com as categorias duplicadas (021) são movidos para as certas e as duplicadas são apagadas.
-- NÃO APLICADA.
update public.movimentacoes set categoria_id = (select id from public.categorias_financeiro where tipo = 'Entrada' and categoria = 'Venda Produto Loja' and subcategoria = 'Outros')
  where categoria_id in (select id from public.categorias_financeiro where tipo = 'Entrada' and categoria = 'Venda de Produtos' and subcategoria = 'Loja');
update public.movimentacoes set categoria_id = (select id from public.categorias_financeiro where tipo = 'Saída' and categoria = 'Compra Produto Loja' and subcategoria = 'Outros')
  where categoria_id in (select id from public.categorias_financeiro where tipo = 'Saída' and categoria = 'Compra de Produtos' and subcategoria = 'Estoque');
delete from public.categorias_financeiro
  where (tipo, categoria, subcategoria) in (('Entrada', 'Venda de Produtos', 'Loja'), ('Saída', 'Compra de Produtos', 'Estoque'));

create or replace function public._categoria_estoque(p_tipo text, p_categoria text, p_sub text) returns uuid
  language sql stable set search_path = public, pg_temp as $$
  select c.id from public.categorias_financeiro c
  where c.tipo = p_tipo
    and c.categoria = case p_categoria when 'Venda de Produtos' then 'Venda Produto Loja' when 'Compra de Produtos' then 'Compra Produto Loja' else p_categoria end
    and c.subcategoria is not distinct from case when p_categoria in ('Venda de Produtos', 'Compra de Produtos') then 'Outros' else p_sub end
  limit 1
$$;
