-- ============================================================================
--  Migração — Escopo de falha (painel/dispositivo) + painel como item de visita
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--  Doc: instrucoes-escopo-falha-e-painel-selecionavel.md
--
--  Faz:
--   1. atendimentos/inspecoes ganham falha_escopo (derivado do código NO APP —
--      escopoDaFalha() em createAtendimento/createInspecao/updateAtendimento/
--      updateInspecao — nunca escolhido à mão pelo técnico).
--   2. atendimentos/inspecoes ganham painel_id (FK nullable) — "o painel em si"
--      vira alvo. No app só entra em Manutenção/Corretiva e Diagnóstico; Inspeção
--      e "Agendar inspeção" seguem só com dispositivos.
--   3. CHECK de alvo único passa a aceitar painel_id como 4ª opção.
--   4. Backfill de falha_escopo nas linhas antigas que já têm falha_codigo.
--
--  Tudo aditivo. RLS não muda: o escopo por cliente dessas tabelas já usa
--  cliente_id (migração anterior), e resolveClienteId() preenche cliente_id a
--  partir de paineis.cliente_id quando o alvo é o painel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 — falha_escopo
-- ---------------------------------------------------------------------------
alter table atendimentos add column if not exists falha_escopo text;
alter table inspecoes    add column if not exists falha_escopo text;

-- ---------------------------------------------------------------------------
-- PASSO 2 — painel_id (FK nullable)
--   on delete set null: mesma política de rvts/combate_conjuntos (não travar o
--   delete do painel por FK). Observação: se a linha tiver painel_id como ÚNICO
--   alvo, o set null a deixa sem alvo e o CHECK do passo 3 barra o delete do
--   painel — mesmo comportamento que bateria_painel_id / fonte_auxiliar_id já
--   têm hoje. Reatribua/exclua essas corretivas antes de excluir o painel.
-- ---------------------------------------------------------------------------
alter table atendimentos add column if not exists painel_id text references paineis(id) on delete set null;
alter table inspecoes    add column if not exists painel_id text references paineis(id) on delete set null;
create index if not exists idx_atendimentos_painel_id on atendimentos (painel_id);
create index if not exists idx_inspecoes_painel_id    on inspecoes (painel_id);

-- ---------------------------------------------------------------------------
-- PASSO 3 — CHECK de alvo único (exatamente um: dispositivo, bateria, fonte OU painel)
--   Se algum ALTER falhar, rode a query de descoberta abaixo pra achar a linha ruim.
--
--   select id, dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id
--     from atendimentos
--    where num_nonnulls(dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id) <> 1;
-- ---------------------------------------------------------------------------
alter table atendimentos drop constraint if exists atendimentos_alvo_unico_check;
alter table atendimentos add constraint atendimentos_alvo_unico_check
  check (num_nonnulls(dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id) = 1);

alter table inspecoes drop constraint if exists inspecoes_alvo_unico_check;
alter table inspecoes add constraint inspecoes_alvo_unico_check
  check (num_nonnulls(dispositivo_id, bateria_painel_id, fonte_auxiliar_id, painel_id) = 1);

-- ---------------------------------------------------------------------------
-- PASSO 4 — Backfill de falha_escopo (linhas antigas com falha_codigo).
--   'dispositivo' = falha de um endereço específico no laço; todo o resto do
--   catálogo Hochiki/Notifier = 'painel' (inclui terra, laço/NAC, rede, sistema).
--   Texto livre sem código fica NULL (sem escopo derivável) — igual no app.
-- ---------------------------------------------------------------------------
update atendimentos set falha_escopo = case
  when falha_codigo in (
    'HOC-02','HOC-05','HOC-06','HOC-08','HOC-09','HOC-10','HOC-11',
    'HOC-28','HOC-29','HOC-30','HOC-31','HOC-56','HOC-72','HOC-73',
    'NOT-08','NOT-09','NOT-24','NOT-25','NOT-31','NOT-40','NOT-44','NOT-45','NOT-58','NOT-71'
  ) then 'dispositivo'
  else 'painel'
end
where falha_codigo is not null and falha_escopo is null;

update inspecoes set falha_escopo = case
  when falha_codigo in (
    'HOC-02','HOC-05','HOC-06','HOC-08','HOC-09','HOC-10','HOC-11',
    'HOC-28','HOC-29','HOC-30','HOC-31','HOC-56','HOC-72','HOC-73',
    'NOT-08','NOT-09','NOT-24','NOT-25','NOT-31','NOT-40','NOT-44','NOT-45','NOT-58','NOT-71'
  ) then 'dispositivo'
  else 'painel'
end
where falha_codigo is not null and falha_escopo is null;

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select 'colunas novas' as check,
       count(*) filter (where table_name = 'atendimentos' and column_name = 'falha_escopo') as at_falha_escopo,
       count(*) filter (where table_name = 'atendimentos' and column_name = 'painel_id')    as at_painel_id,
       count(*) filter (where table_name = 'inspecoes'    and column_name = 'falha_escopo') as in_falha_escopo,
       count(*) filter (where table_name = 'inspecoes'    and column_name = 'painel_id')    as in_painel_id
  from information_schema.columns
 where table_name in ('atendimentos', 'inspecoes');

select 'falha_escopo em atendimentos' as t, falha_escopo, count(*)
  from atendimentos group by falha_escopo order by 3 desc;
