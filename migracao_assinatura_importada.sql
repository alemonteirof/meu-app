-- migracao_assinatura_importada.sql
-- Libera a origem 'importada' (assinatura vinda de arquivo PNG/JPG) no checklist de
-- ferramentas. A imagem é gravada como assinatura_tipo = 'desenho' (é uma imagem);
-- só a origem muda, pra trilha de auditoria saber que veio de arquivo.
-- RVT não precisa: rvts.assinatura_cliente_origem não tem CHECK.
-- Rodar ANTES de subir o build. Não altera registro existente.

begin;

alter table public.tool_checklists drop constraint tool_checklists_assinatura_origem_check;
alter table public.tool_checklists add constraint tool_checklists_assinatura_origem_check
  check (assinatura_origem in ('desenho', 'texto', 'salva', 'importada'));

commit;

-- Verificação: deve listar 'importada'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'tool_checklists_assinatura_origem_check';
