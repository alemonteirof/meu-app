-- ============================================================================
--  Migração — Assinatura digital do TÉCNICO no RVT
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--
--  Entrega:
--   1. rvts ganha colunas assinatura_tecnico_* (valor/tipo/origem + carimbo)
--   2. trigger BEFORE UPDATE: só membro MAJ (is_maj_staff) assina/refaz/apaga;
--      uid/email/nome/data vêm do servidor (não dá pra forjar pelo app) e os
--      campos de carimbo não podem ser alterados sozinhos
--   3. cada assinatura do técnico vira evento na trilha assinatura_auditoria
--      ('tecnico_assinada' | 'tecnico_refeita'), junto da trilha do cliente
--
--  Tudo aditivo. Não altera registro existente (RVTs antigos ficam sem assinatura
--  do técnico — imprimem com a linha em branco).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — colunas
-- ---------------------------------------------------------------------------
alter table public.rvts add column if not exists assinatura_tecnico         text;
alter table public.rvts add column if not exists assinatura_tecnico_tipo    text;  -- 'desenho' | 'texto'
alter table public.rvts add column if not exists assinatura_tecnico_origem  text;  -- 'desenho' | 'texto' | 'salva' | 'importada'
alter table public.rvts add column if not exists assinatura_tecnico_data    timestamptz;
alter table public.rvts add column if not exists assinatura_tecnico_login   text;
alter table public.rvts add column if not exists assinatura_tecnico_user_id uuid;
alter table public.rvts add column if not exists assinatura_tecnico_nome    text;

-- ---------------------------------------------------------------------------
-- PASSO 2 — trigger: exige membro MAJ + carimba atribuição + auditoria
-- ---------------------------------------------------------------------------
create or replace function public.log_assinatura_tecnico_rvt()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if new.assinatura_tecnico is not distinct from old.assinatura_tecnico then
    -- assinatura não mudou: carimbo fica travado no valor anterior
    new.assinatura_tecnico_tipo    := old.assinatura_tecnico_tipo;
    new.assinatura_tecnico_origem  := old.assinatura_tecnico_origem;
    new.assinatura_tecnico_data    := old.assinatura_tecnico_data;
    new.assinatura_tecnico_login   := old.assinatura_tecnico_login;
    new.assinatura_tecnico_user_id := old.assinatura_tecnico_user_id;
    new.assinatura_tecnico_nome    := old.assinatura_tecnico_nome;
    return new;
  end if;

  if not is_maj_staff() then
    raise exception 'Somente membros MAJ podem assinar como técnico responsável.';
  end if;

  if new.assinatura_tecnico is null then
    new.assinatura_tecnico_tipo    := null;
    new.assinatura_tecnico_origem  := null;
    new.assinatura_tecnico_data    := null;
    new.assinatura_tecnico_login   := null;
    new.assinatura_tecnico_user_id := null;
    new.assinatura_tecnico_nome    := null;
    return new;
  end if;

  -- fonte de verdade da atribuição = servidor
  new.assinatura_tecnico_user_id := auth.uid();
  new.assinatura_tecnico_login   := auth.jwt() ->> 'email';
  new.assinatura_tecnico_nome    := (select nome from public.profiles where id = auth.uid());
  new.assinatura_tecnico_data    := now();
  new.assinatura_tecnico_origem  := coalesce(new.assinatura_tecnico_origem, new.assinatura_tecnico_tipo);

  insert into public.assinatura_auditoria (
    rvt_id, cliente_id, evento, assinatura_tipo, assinatura_origem,
    assinatura_hash, assinado_por_uid, assinado_por_email
  ) values (
    new.id,
    new.cliente_id,
    case when old.assinatura_tecnico is null then 'tecnico_assinada' else 'tecnico_refeita' end,
    new.assinatura_tecnico_tipo,
    new.assinatura_tecnico_origem,
    encode(digest(new.assinatura_tecnico, 'sha256'), 'hex'),
    auth.uid(),
    auth.jwt() ->> 'email'
  );
  return new;
end;
$$;

drop trigger if exists trg_log_assinatura_tecnico_rvt on public.rvts;
create trigger trg_log_assinatura_tecnico_rvt
  before update on public.rvts
  for each row
  execute function public.log_assinatura_tecnico_rvt();

-- Em INSERT ninguém nasce assinado como técnico (assinatura só via UPDATE carimbado).
create or replace function public.bloqueia_assinatura_tecnico_insert()
  returns trigger
  language plpgsql
as $$
begin
  new.assinatura_tecnico         := null;
  new.assinatura_tecnico_tipo    := null;
  new.assinatura_tecnico_origem  := null;
  new.assinatura_tecnico_data    := null;
  new.assinatura_tecnico_login   := null;
  new.assinatura_tecnico_user_id := null;
  new.assinatura_tecnico_nome    := null;
  return new;
end;
$$;

drop trigger if exists trg_bloqueia_assinatura_tecnico_insert on public.rvts;
create trigger trg_bloqueia_assinatura_tecnico_insert
  before insert on public.rvts
  for each row
  execute function public.bloqueia_assinatura_tecnico_insert();

commit;

-- ---------------------------------------------------------------------------
-- Verificação — esperado: 7 / 2
-- ---------------------------------------------------------------------------
select 'rvts assinatura_tecnico*' as item, count(*) as ok from information_schema.columns
 where table_name = 'rvts' and column_name like 'assinatura_tecnico%'
union all
select 'triggers', count(*) from pg_trigger
 where tgname in ('trg_log_assinatura_tecnico_rvt', 'trg_bloqueia_assinatura_tecnico_insert');
