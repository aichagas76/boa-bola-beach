-- Aluno com matrícula em COMBO (Clubinho de Beach Tênis nas duas unidades) passa a ser visível
-- para quem tem acesso a qualquer uma das duas unidades. Antes só enxergava quem tinha a unidade da matrícula.
-- NÃO APLICADA.
create or replace function public.aluno_visivel(aid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.alunos a where a.id = aid and a.unidade_id in (select public.minhas_unidades()))
      or exists (select 1 from public.matriculas m where m.aluno_id = aid
                 and (m.unidade_id in (select public.minhas_unidades()) or m.acesso_duas_unidades))
$$;
