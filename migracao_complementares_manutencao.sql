-- ============================================================================
--  Migração — Complementares mantíveis no pipeline SDAI + categoria "Rede"
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Faz:
--   1. atendimentos/inspecoes ganham cliente_id (denormalizado) + backfill
--   2. atendimentos/inspecoes ganham bateria_painel_id / fonte_auxiliar_id (FK nullable)
--   3. CHECK de alvo único
--   4. RLS de atendimentos/inspecoes passa a usar cliente_id  (SECÇÃO MANUAL — ler)
--   5. dispositivos.tipo_modulo aceita rede_conversor / rede_placa  (SECÇÃO MANUAL — ler)
--
--  As secções 1-3 são aditivas e seguras. As 4-5 dependem do que já existe no
--  banco — tem query de descoberta e passo a passo logo abaixo de cada uma.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 — cliente_id denormalizado
-- ---------------------------------------------------------------------------
alter table atendimentos add column if not exists cliente_id text references clientes(id);
alter table inspecoes    add column if not exists cliente_id text references clientes(id);

update atendimentos a
   set cliente_id = d.cliente_id
  from dispositivos d
 where d.id = a.dispositivo_id
   and a.cliente_id is null;

update inspecoes i
   set cliente_id = d.cliente_id
  from dispositivos d
 where d.id = i.dispositivo_id
   and i.cliente_id is null;

create index if not exists idx_atendimentos_cliente_id on atendimentos (cliente_id);
create index if not exists idx_inspecoes_cliente_id    on inspecoes (cliente_id);

-- Confirme que zerou (tem que dar 0 nos dois) ANTES de rodar o PASSO 4:
select 'atendimentos sem cliente_id' as t, count(*) from atendimentos where cliente_id is null
union all
select 'inspecoes sem cliente_id', count(*) from inspecoes where cliente_id is null;

-- ---------------------------------------------------------------------------
-- PASSO 2 — FK nullable p/ Bateria de Painel e Fonte Auxiliar
-- ---------------------------------------------------------------------------
alter table atendimentos add column if not exists bateria_painel_id text references baterias_painel(id) on delete set null;
alter table atendimentos add column if not exists fonte_auxiliar_id text references fontes_auxiliares(id) on delete set null;
alter table inspecoes    add column if not exists bateria_painel_id text references baterias_painel(id) on delete set null;
alter table inspecoes    add column if not exists fonte_auxiliar_id text references fontes_auxiliares(id) on delete set null;

-- ---------------------------------------------------------------------------
-- PASSO 3 — CHECK de alvo único (exatamente um: dispositivo, bateria ou fonte)
-- ---------------------------------------------------------------------------
alter table atendimentos drop constraint if exists atendimentos_alvo_unico_check;
alter table atendimentos add constraint atendimentos_alvo_unico_check
  check (num_nonnulls(dispositivo_id, bateria_painel_id, fonte_auxiliar_id) = 1);

alter table inspecoes drop constraint if exists inspecoes_alvo_unico_check;
alter table inspecoes add constraint inspecoes_alvo_unico_check
  check (num_nonnulls(dispositivo_id, bateria_painel_id, fonte_auxiliar_id) = 1);

-- ===========================================================================
-- PASSO 4 — RLS de atendimentos / inspecoes  (MANUAL)
-- ===========================================================================
-- Hoje as policies dessas tabelas quase certamente fazem o escopo por cliente
-- via JOIN com dispositivos. Com atendimentos de bateria/fonte (dispositivo_id
-- nulo), esse JOIN barra a linha. Troque para escopo por cliente_id.
--
-- 4a. Descubra as policies atuais:
--
--   select policyname, cmd, qual, with_check
--     from pg_policies
--    where tablename in ('atendimentos', 'inspecoes')
--    order by tablename, policyname;
--
-- 4b. Para CADA policy listada, recrie trocando a condição que referencia
--     dispositivos por  has_client_access(cliente_id)  (mantendo o resto: cmd,
--     roles, is_admin() etc). Modelo (ajuste os nomes reais):
--
--   drop policy "<nome_da_policy>" on atendimentos;
--   create policy "<nome_da_policy>" on atendimentos
--     for <cmd> to <roles>
--     using ( is_admin() or has_client_access(cliente_id) )
--     with check ( is_admin() or has_client_access(cliente_id) );
--
--   (idem para inspecoes)
--
-- 4c. Só rode isto depois que o PASSO 1 acusou 0 linhas sem cliente_id.

-- ===========================================================================
-- PASSO 5 — dispositivos.tipo_modulo aceita rede_conversor / rede_placa (MANUAL)
-- ===========================================================================
-- 5a. Ache o CHECK atual (se existir) e os valores que ele permite:
--
--   select con.conname, pg_get_constraintdef(con.oid)
--     from pg_constraint con
--     join pg_class rel on rel.oid = con.conrelid
--    where rel.relname = 'dispositivos' and con.contype = 'c';
--
-- 5b. Recrie incluindo os dois novos valores. Modelo (troque <conname> e a
--     lista pela real, só ACRESCENTANDO 'rede_conversor' e 'rede_placa'):
--
--   alter table dispositivos drop constraint if exists <conname>;
--   alter table dispositivos add constraint <conname> check (
--     tipo_modulo in (
--       'fumaca','calor','acionador','saida','rele','entrada','entrada_duplo',
--       'modulo_saida','detector_gas','outro',
--       'rede_conversor','rede_placa'
--     )
--   );
--
-- Se NÃO houver CHECK em tipo_modulo, não precisa fazer nada aqui — a validação
-- no app (TIPOS_MODULO_VALIDOS em supabaseAdapter.js) já cobre.

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select 'colunas novas em atendimentos' as check,
       count(*) filter (where column_name = 'cliente_id') as cliente_id,
       count(*) filter (where column_name = 'bateria_painel_id') as bateria_painel_id,
       count(*) filter (where column_name = 'fonte_auxiliar_id') as fonte_auxiliar_id
  from information_schema.columns
 where table_name = 'atendimentos';
