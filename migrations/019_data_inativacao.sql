-- Painel: "Cancelamentos/inativações" e a evolução da base de alunos precisam saber QUANDO o aluno foi inativado.
-- Hoje o cadastro só guarda o status. Esta migration passa a registrar a data automaticamente
-- (quando o status vira Inativo grava hoje; quando volta a Ativo, apaga). Nada existente é alterado:
-- quem já está inativo fica sem data (o painel avisa quantos são), pois essa data não existe em lugar nenhum. NÃO APLICADA.
alter table public.alunos add column if not exists data_inativacao date;

create or replace function public.registrar_data_inativacao() returns trigger language plpgsql as $$
begin
  if new.status = 'Inativo' and (tg_op = 'INSERT' or old.status is distinct from 'Inativo') then
    new.data_inativacao := (now() at time zone 'America/Sao_Paulo')::date;
  elsif new.status is distinct from 'Inativo' then
    new.data_inativacao := null;
  end if;
  return new;
end $$;

drop trigger if exists alunos_data_inativacao on public.alunos;
create trigger alunos_data_inativacao before insert or update of status on public.alunos
  for each row execute function public.registrar_data_inativacao();
