-- ============================================================================
--  Migração — RLS da tabela memberships (vincular usuário a cliente)
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Sintoma corrigido:
--    Configurações > Operadores > "Vincular" retorna
--    'new row violates row-level security policy for table "memberships"'.
--
--  Causa: existia a policy admin_gerencia_memberships (is_admin(), FOR ALL),
--  mas ela NÃO estava concedendo INSERT — provável RESTRICTIVE. Sem nenhuma
--  policy PERMISSIVA de INSERT, todo vínculo pelo app era barrado.
--
--  Faz: cria memberships_admin_all (PERMISSIVA, is_admin(), FOR ALL) — foi
--  ela que destravou o "Vincular" — e memberships_self_select pra cada
--  usuário ler os próprios vínculos. Tudo idempotente.
--  (a admin_gerencia_memberships / ver_proprias_memberships antigas podem
--   continuar; são redundantes agora, não atrapalham.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO (opcional) — rode isolado antes pra ver o estado atual
-- ---------------------------------------------------------------------------
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies where tablename = 'memberships';
-- select relrowsecurity from pg_class where relname = 'memberships';

-- ---------------------------------------------------------------------------
-- PASSO 1 — garante RLS ligado
-- ---------------------------------------------------------------------------
alter table memberships enable row level security;

-- ---------------------------------------------------------------------------
-- PASSO 2 — staff da plataforma administra tudo
--   is_admin() é SECURITY DEFINER e olha profiles.role (não recursa em
--   memberships). Cobre SELECT/INSERT/UPDATE/DELETE num policy só.
-- ---------------------------------------------------------------------------
drop policy if exists "memberships_admin_all" on memberships;
create policy "memberships_admin_all" on memberships
  for all to authenticated
  using ( is_admin() )
  with check ( is_admin() );

-- ---------------------------------------------------------------------------
-- PASSO 3 — cada usuário lê os próprios vínculos (usado no login/AuthGate)
-- ---------------------------------------------------------------------------
drop policy if exists "memberships_self_select" on memberships;
create policy "memberships_self_select" on memberships
  for select to authenticated
  using ( user_id = auth.uid() );

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
  from pg_policies where tablename = 'memberships'
 order by policyname;
