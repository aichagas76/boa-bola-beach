-- ETAPA 5 (correção da 009): ao cadastrar um aluno, o banco confere se ele já pode ser lido logo depois de gravado.
-- A função aluno_visivel não enxerga a linha recém-criada; por isso a leitura também aceita a unidade direta.
drop policy if exists "alunos da minha unidade" on public.alunos;
create policy "alunos da minha unidade" on public.alunos for select to authenticated
  using (unidade_id in (select public.minhas_unidades()) or public.aluno_visivel(id));
