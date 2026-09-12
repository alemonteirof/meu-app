-- ============================================================================
--  Migração — Resolver em nova visita item pendente (Aguardando/Andamento) de
--  uma visita anterior.
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Faz:
--   1. atendimentos ganha resolvido_rvt_id (FK nullable pra rvts) e
--      data_resolucao — registram em qual visita e quando o item foi marcado
--      Resolvido, independente de qual visita o criou originalmente.
--   2. on delete set null: mesma política de painel_id/rvt_itens (apagar a
--      visita que resolveu não trava nem apaga a corretiva, só perde a
--      referência de "resolvida em qual visita").
--
--  Tudo aditivo — nenhuma coluna/linha existente é alterada.
-- ============================================================================

-- rvts.id é uuid (diferente das outras entidades, que usam uid() em text).
alter table atendimentos add column if not exists resolvido_rvt_id uuid references rvts(id) on delete set null;
alter table atendimentos add column if not exists data_resolucao date;
create index if not exists idx_atendimentos_resolvido_rvt_id on atendimentos (resolvido_rvt_id);

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select 'colunas novas' as check,
       count(*) filter (where column_name = 'resolvido_rvt_id') as resolvido_rvt_id,
       count(*) filter (where column_name = 'data_resolucao')   as data_resolucao
  from information_schema.columns
 where table_name = 'atendimentos';
