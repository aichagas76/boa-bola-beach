-- Índices nas ligações entre tabelas que ainda não tinham (aviso de desempenho do Supabase: 26 pontos).
-- Sem eles, buscas como "todos os lançamentos do aluno" ou "as matrículas deste professor" precisam varrer a tabela inteira
-- quando os dados crescerem. Não muda nada do que se vê na tela. (As 3 regras de acesso lentas já foram ajustadas na 028.) APLICADA.
create index if not exists idx_acessos_unidade on public.acessos (unidade_id);
create index if not exists idx_avisos_whatsapp_aluno on public.avisos_whatsapp (aluno_id);
create index if not exists idx_contas_bancarias_unidade on public.contas_bancarias (unidade_id);
create index if not exists idx_estoque_compras_fornecedor on public.estoque_compras (fornecedor_id);
create index if not exists idx_estoque_compras_movimentacao on public.estoque_compras (movimentacao_id);
create index if not exists idx_estoque_compras_unidade on public.estoque_compras (unidade_id);
create index if not exists idx_estoque_produtos_comissao_professor on public.estoque_produtos (comissao_professor_id);
create index if not exists idx_estoque_produtos_fornecedor on public.estoque_produtos (fornecedor_id);
create index if not exists idx_estoque_retiradas_comissao_mov on public.estoque_retiradas (comissao_movimentacao_id);
create index if not exists idx_estoque_retiradas_indicacao_mov on public.estoque_retiradas (indicacao_movimentacao_id);
create index if not exists idx_estoque_retiradas_indicacao_prof on public.estoque_retiradas (indicacao_professor_id);
create index if not exists idx_estoque_retiradas_movimentacao on public.estoque_retiradas (movimentacao_id);
create index if not exists idx_estoque_retiradas_professor on public.estoque_retiradas (professor_id);
create index if not exists idx_estoque_retiradas_unidade on public.estoque_retiradas (unidade_id);
create index if not exists idx_matriculas_aluno on public.matriculas (aluno_id);
create index if not exists idx_matriculas_professor on public.matriculas (professor_id);
create index if not exists idx_matriculas_unidade on public.matriculas (unidade_id);
create index if not exists idx_modalidade_esportes_esporte on public.modalidade_esportes (esporte_id);
create index if not exists idx_movimentacoes_aluno on public.movimentacoes (aluno_id);
create index if not exists idx_movimentacoes_aluno_ref on public.movimentacoes (aluno_ref_id);
create index if not exists idx_movimentacoes_categoria on public.movimentacoes (categoria_id);
create index if not exists idx_movimentacoes_conta on public.movimentacoes (conta_bancaria_id);
create index if not exists idx_movimentacoes_pessoa on public.movimentacoes (pessoa_id);
create index if not exists idx_movimentacoes_professor on public.movimentacoes (professor_id);
create index if not exists idx_movimentacoes_unidade on public.movimentacoes (unidade_id);
create index if not exists idx_pagamentos_matricula on public.pagamentos (matricula_id);
