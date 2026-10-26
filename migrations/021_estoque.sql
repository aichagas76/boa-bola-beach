-- ESTOQUE: produtos, compras (entrada) e retiradas/vendas (saída) a aluno ou professor, por unidade.
-- A venda paga na hora vira ENTRADA no financeiro; a não paga vira entrada "Não recebido" com vencimento
-- no dia da mensalidade do aluno (professor: fim do mês). Produto de encordoamento lança a comissão
-- como SAÍDA (R$ 10 por padrão, professor e valor podem ser trocados em cada venda). NÃO APLICADA.

create table if not exists public.estoque_produtos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) default public.unidade_padrao(),
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  fornecedor_id uuid references public.pessoas(id) on delete set null,
  custo numeric(12,2) not null default 0 check (custo >= 0),
  preco_aluno numeric(12,2) not null default 0 check (preco_aluno >= 0),
  preco_professor numeric(12,2) check (preco_professor >= 0),
  limite_compra integer not null default 0 check (limite_compra >= 0),
  encordoamento boolean not null default false,
  comissao_valor numeric(12,2) not null default 10 check (comissao_valor >= 0),
  comissao_professor_id uuid references public.professores(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists estoque_produtos_nome_unidade on public.estoque_produtos (unidade_id, lower(trim(nome)));

create table if not exists public.estoque_compras (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) default public.unidade_padrao(),
  produto_id uuid not null references public.estoque_produtos(id),
  data date not null default current_date,
  quantidade integer not null check (quantidade > 0),
  custo_unitario numeric(12,2) not null check (custo_unitario >= 0),
  fornecedor_id uuid references public.pessoas(id) on delete set null,
  movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_retiradas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) default public.unidade_padrao(),
  produto_id uuid not null references public.estoque_produtos(id),
  data date not null default current_date,
  quantidade integer not null check (quantidade > 0),
  comprador text not null check (comprador in ('aluno', 'professor')),
  aluno_id uuid references public.alunos(id),
  professor_id uuid references public.professores(id),
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  custo_unitario numeric(12,2) not null default 0,
  movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  comissao_movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((comprador = 'aluno' and aluno_id is not null) or (comprador = 'professor' and professor_id is not null))
);
create index if not exists estoque_compras_produto on public.estoque_compras (produto_id);
create index if not exists estoque_retiradas_produto on public.estoque_retiradas (produto_id);
create index if not exists estoque_retiradas_aluno on public.estoque_retiradas (aluno_id);

-- Acesso por unidade (mesma regra do financeiro)
alter table public.estoque_produtos enable row level security;
alter table public.estoque_compras enable row level security;
alter table public.estoque_retiradas enable row level security;
create policy "produtos da minha unidade" on public.estoque_produtos for all to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));
create policy "compras da minha unidade" on public.estoque_compras for all to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));
create policy "retiradas da minha unidade" on public.estoque_retiradas for all to authenticated
  using (unidade_id in (select public.minhas_unidades())) with check (unidade_id in (select public.minhas_unidades()));
revoke all on public.estoque_produtos, public.estoque_compras, public.estoque_retiradas from anon;
revoke truncate, references, trigger on public.estoque_produtos, public.estoque_compras, public.estoque_retiradas from authenticated;

-- Saldo de cada produto (entrou menos saiu), respeitando o acesso do usuário
create or replace view public.estoque_saldos with (security_invoker = true) as
  select p.id as produto_id,
         coalesce((select sum(c.quantidade) from public.estoque_compras c where c.produto_id = p.id), 0)
       - coalesce((select sum(r.quantidade) from public.estoque_retiradas r where r.produto_id = p.id), 0) as saldo
  from public.estoque_produtos p;
grant select on public.estoque_saldos to authenticated;
revoke all on public.estoque_saldos from anon;

-- Categorias do financeiro usadas pelo estoque
insert into public.categorias_financeiro (tipo, categoria, subcategoria)
  select v.tipo, v.categoria, v.subcategoria
  from (values ('Entrada', 'Venda de Produtos', 'Loja'),
               ('Saída', 'Compra de Produtos', 'Estoque'),
               ('Saída', 'Mão de Obra', 'Comissão de encordoamento')) as v(tipo, categoria, subcategoria)
  where not exists (select 1 from public.categorias_financeiro c
                    where c.tipo = v.tipo and c.categoria = v.categoria and c.subcategoria is not distinct from v.subcategoria);

create or replace function public._categoria_estoque(p_tipo text, p_categoria text, p_sub text) returns uuid
  language sql stable as $$
  select id from public.categorias_financeiro where tipo = p_tipo and categoria = p_categoria and subcategoria = p_sub limit 1
$$;

-- Compra: entra no estoque, atualiza o custo do produto e (se pedido) lança a saída no financeiro
create or replace function public.estoque_comprar(
  p_produto uuid, p_quantidade integer, p_custo numeric, p_fornecedor uuid, p_data date,
  p_lancar boolean, p_forma text, p_banco uuid
) returns uuid language plpgsql as $$
declare pr public.estoque_produtos%rowtype; mov uuid; cid uuid;
begin
  select * into pr from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade'; end if;
  if p_custo is null or p_custo < 0 then raise exception 'Informe o custo'; end if;
  if p_lancar then
    insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, pessoa_id,
        banco_id, status, data_vencimento, data_pagamento, origem)
      values (pr.unidade_id, p_data, 'Saída', public._categoria_estoque('Saída', 'Compra de Produtos', 'Estoque'),
        'Compra: ' || pr.nome || ' x' || p_quantidade, round(p_custo * p_quantidade, 2), coalesce(p_forma, 'Pix'),
        p_fornecedor, p_banco, 'Pago', p_data, p_data, 'Estoque')
      returning id into mov;
  end if;
  insert into public.estoque_compras (unidade_id, produto_id, data, quantidade, custo_unitario, fornecedor_id, movimentacao_id)
    values (pr.unidade_id, p_produto, p_data, p_quantidade, p_custo, p_fornecedor, mov);
  update public.estoque_produtos set custo = p_custo, fornecedor_id = coalesce(p_fornecedor, fornecedor_id) where id = p_produto;
  return mov;
end $$;

-- Venda (retirada): baixa o estoque e lança no financeiro. Paga na hora = Recebido; senão = Não recebido
-- com o vencimento informado. Produto de encordoamento lança a comissão (Saída paga) do professor escolhido.
create or replace function public.estoque_vender(
  p_produto uuid, p_quantidade integer, p_comprador text, p_aluno uuid, p_professor uuid,
  p_pago boolean, p_forma text, p_banco uuid, p_vencimento date, p_data date,
  p_comissao_professor uuid, p_comissao_valor numeric
) returns uuid language plpgsql as $$
declare pr public.estoque_produtos%rowtype; sdo integer; preco numeric; mov uuid; com uuid; ret uuid; nome_comprador text; cvalor numeric;
begin
  select * into pr from public.estoque_produtos where id = p_produto for update;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_comprador not in ('aluno', 'professor') then raise exception 'Comprador inválido'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe a quantidade'; end if;
  if p_comprador = 'aluno' and p_aluno is null then raise exception 'Escolha o aluno'; end if;
  if p_comprador = 'professor' and p_professor is null then raise exception 'Escolha o professor'; end if;
  select saldo into sdo from public.estoque_saldos where produto_id = p_produto;
  if p_quantidade > coalesce(sdo, 0) then raise exception 'Estoque insuficiente: restam %', coalesce(sdo, 0); end if;
  preco := case when p_comprador = 'professor' and pr.preco_professor is not null then pr.preco_professor else pr.preco_aluno end;
  nome_comprador := case when p_comprador = 'aluno' then (select nome from public.alunos where id = p_aluno)
                         else (select nome from public.professores where id = p_professor) end;

  insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, aluno_ref_id,
      professor_id, banco_id, status, data_vencimento, data_pagamento, origem)
    values (pr.unidade_id, p_data, 'Entrada', public._categoria_estoque('Entrada', 'Venda de Produtos', 'Loja'),
      'Venda: ' || pr.nome || ' x' || p_quantidade || ' - ' || coalesce(nome_comprador, ''), round(preco * p_quantidade, 2),
      coalesce(p_forma, 'Pix'), p_aluno, p_professor, case when p_pago then p_banco end,
      case when p_pago then 'Recebido' else 'Não recebido' end,
      case when p_pago then p_data else coalesce(p_vencimento, p_data) end,
      case when p_pago then p_data end, 'Estoque')
    returning id into mov;

  cvalor := coalesce(p_comissao_valor, pr.comissao_valor);
  if pr.encordoamento and cvalor > 0 and coalesce(p_comissao_professor, pr.comissao_professor_id) is not null then
    insert into public.movimentacoes (unidade_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, professor_id,
        esporte_id, status, data_vencimento, data_pagamento, origem)
      values (pr.unidade_id, p_data, 'Saída', public._categoria_estoque('Saída', 'Mão de Obra', 'Comissão de encordoamento'),
        'Comissão de encordoamento: ' || pr.nome || ' x' || p_quantidade, round(cvalor * p_quantidade, 2), 'Pix',
        coalesce(p_comissao_professor, pr.comissao_professor_id), (select id from public.esportes where nome = 'Tênis' limit 1),
        'Pago', p_data, p_data, 'Estoque')
      returning id into com;
  end if;

  insert into public.estoque_retiradas (unidade_id, produto_id, data, quantidade, comprador, aluno_id, professor_id,
      preco_unitario, custo_unitario, movimentacao_id, comissao_movimentacao_id)
    values (pr.unidade_id, p_produto, p_data, p_quantidade, p_comprador, p_aluno, p_professor, preco, pr.custo, mov, com)
    returning id into ret;
  return ret;
end $$;

-- Desfazer um lançamento feito por engano (apaga também o que foi lançado no financeiro)
create or replace function public.estoque_desfazer_venda(p_retirada uuid) returns void language plpgsql as $$
declare r public.estoque_retiradas%rowtype;
begin
  select * into r from public.estoque_retiradas where id = p_retirada for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  delete from public.estoque_retiradas where id = p_retirada;
  delete from public.movimentacoes where id in (r.movimentacao_id, r.comissao_movimentacao_id);
end $$;

create or replace function public.estoque_desfazer_compra(p_compra uuid) returns void language plpgsql as $$
declare c public.estoque_compras%rowtype; sdo integer;
begin
  select * into c from public.estoque_compras where id = p_compra for update;
  if not found then raise exception 'Compra não encontrada'; end if;
  select saldo into sdo from public.estoque_saldos where produto_id = c.produto_id;
  if coalesce(sdo, 0) - c.quantidade < 0 then raise exception 'Não dá para desfazer: já foram vendidas unidades desta compra'; end if;
  delete from public.estoque_compras where id = p_compra;
  delete from public.movimentacoes where id = c.movimentacao_id;
end $$;

revoke all on function public.estoque_comprar, public.estoque_vender, public.estoque_desfazer_venda, public.estoque_desfazer_compra from public, anon;
grant execute on function public.estoque_comprar, public.estoque_vender, public.estoque_desfazer_venda, public.estoque_desfazer_compra to authenticated;
