-- Responsável pelo aluno: quando existe, a cobrança do Asaas e os avisos de WhatsApp vão para ele. NÃO APLICADA.
-- asaas_customer_doc guarda o CPF do cliente criado no Asaas, para saber se ele ainda serve
-- quando o responsável é incluído, trocado ou retirado.
alter table public.alunos add column if not exists responsavel_nome text;
alter table public.alunos add column if not exists responsavel_cpf text;
alter table public.alunos add column if not exists responsavel_celular text;
alter table public.alunos add column if not exists asaas_customer_doc text;
