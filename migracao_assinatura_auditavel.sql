-- ============================================================================
--  Migração — Assinatura do RVT auditável + assinatura salva (reutilizável)
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Entrega:
--   1. rvts ganha colunas de atribuição da assinatura (login/uid/origem)
--   2. assinatura_auditoria: tabela append-only (sem UPDATE/DELETE) com trilha
--      de quem assinou, quando e hash da assinatura — preenchida por TRIGGER,
--      então o cliente não consegue forjar (auth.uid()/auth.jwt() são do servidor)
--   3. trigger em rvts carimba login/uid/data no próprio registro + grava auditoria
--   4. assinaturas_salvas: 1 assinatura por usuário, pra não redesenhar toda vez
--
--  Tudo aditivo. Não altera dado existente nem RLS de outras tabelas.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- PASSO 1 — colunas de atribuição no próprio rvt (cache p/ exibição rápida)
-- ---------------------------------------------------------------------------
alter table rvts add column if not exists assinatura_cliente_login   text;
alter table rvts add column if not exists assinatura_cliente_user_id uuid;
alter table rvts add column if not exists assinatura_cliente_origem  text;  -- 'desenho' | 'texto' | 'salva'

-- ---------------------------------------------------------------------------
-- PASSO 2 — trilha de auditoria append-only
-- ---------------------------------------------------------------------------
create table if not exists assinatura_auditoria (
  id                bigint generated always as identity primary key,
  rvt_id            uuid not null references rvts(id) on delete cascade,
  cliente_id        text,                       -- denormalizado p/ RLS
  evento            text not null,              -- 'assinada' | 'refeita'
  assinatura_tipo   text,                       -- 'desenho' | 'texto'
  assinatura_origem text,                       -- 'desenho' | 'texto' | 'salva'
  assinatura_hash   text,                       -- sha256 hex do valor assinado
  assinado_por_uid   uuid,
  assinado_por_email text,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_assinatura_auditoria_rvt on assinatura_auditoria (rvt_id);

alter table assinatura_auditoria enable row level security;

-- Leitura: admin ou quem tem acesso ao cliente. SEM policy de insert/update/delete
-- p/ usuário final => ninguém edita/apaga; só o trigger (SECURITY DEFINER) escreve.
drop policy if exists "assinatura_auditoria_select" on assinatura_auditoria;
create policy "assinatura_auditoria_select" on assinatura_auditoria
  for select using ( is_admin() or has_client_access(cliente_id) );

-- ---------------------------------------------------------------------------
-- PASSO 3 — trigger: carimba atribuição no rvt + grava auditoria
-- ---------------------------------------------------------------------------
create or replace function log_assinatura_rvt()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  -- só age quando a assinatura foi criada ou trocada
  if new.assinatura_cliente is distinct from old.assinatura_cliente
     and new.assinatura_cliente is not null then

    -- fonte de verdade da atribuição = servidor (não confia no que o app mandou)
    new.assinatura_cliente_user_id := auth.uid();
    new.assinatura_cliente_login   := auth.jwt() ->> 'email';
    new.assinatura_cliente_data    := now();

    insert into assinatura_auditoria (
      rvt_id, cliente_id, evento, assinatura_tipo, assinatura_origem,
      assinatura_hash, assinado_por_uid, assinado_por_email
    ) values (
      new.id,
      new.cliente_id,
      case when old.assinatura_cliente is null then 'assinada' else 'refeita' end,
      new.assinatura_cliente_tipo,
      coalesce(new.assinatura_cliente_origem, new.assinatura_cliente_tipo),
      encode(digest(new.assinatura_cliente, 'sha256'), 'hex'),
      auth.uid(),
      auth.jwt() ->> 'email'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_assinatura_rvt on rvts;
create trigger trg_log_assinatura_rvt
  before update on rvts
  for each row
  execute function log_assinatura_rvt();

-- ---------------------------------------------------------------------------
-- PASSO 4 — assinatura salva por usuário (reutilização)
-- ---------------------------------------------------------------------------
create table if not exists assinaturas_salvas (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  tipo          text not null check (tipo in ('desenho','texto')),
  valor         text not null,
  atualizado_em timestamptz not null default now()
);

alter table assinaturas_salvas enable row level security;

drop policy if exists "assinaturas_salvas_select" on assinaturas_salvas;
drop policy if exists "assinaturas_salvas_insert" on assinaturas_salvas;
drop policy if exists "assinaturas_salvas_update" on assinaturas_salvas;
drop policy if exists "assinaturas_salvas_delete" on assinaturas_salvas;

create policy "assinaturas_salvas_select" on assinaturas_salvas
  for select using ( user_id = auth.uid() );
create policy "assinaturas_salvas_insert" on assinaturas_salvas
  for insert with check ( user_id = auth.uid() );
create policy "assinaturas_salvas_update" on assinaturas_salvas
  for update using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
create policy "assinaturas_salvas_delete" on assinaturas_salvas
  for delete using ( user_id = auth.uid() );

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'rvts'                as tabela, count(*) filter (where column_name like 'assinatura_cliente_%') as cols
  from information_schema.columns where table_name = 'rvts'
union all
select 'assinatura_auditoria', count(*) from information_schema.tables where table_name = 'assinatura_auditoria'
union all
select 'assinaturas_salvas',   count(*) from information_schema.tables where table_name = 'assinaturas_salvas';
