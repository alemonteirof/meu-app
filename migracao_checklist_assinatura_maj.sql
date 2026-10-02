-- ============================================================================
--  Migração — Checklist de ferramentas: cinto Y, assinatura MAJ auditável,
--  nome/empresa no perfil (primeiro login)
--  Rodar UMA vez no SQL Editor do Supabase, IMEDIATAMENTE antes de subir o build
--  (a partir daqui o banco exige assinatura em todo checklist novo). Sem BOM.
--
--  Entrega:
--   1. tipo 'cinto_talabarte' (SEG-EPI-001) liberado em equipamentos/tool_checklists
--   2. profiles ganha nome/empresa + RPC definir_meu_perfil (só mexe nesses 2
--      campos — o usuário continua sem poder alterar o próprio role)
--   3. tool_checklists ganha colunas de assinatura; trigger BEFORE INSERT exige
--      membro MAJ (admin/operador) + assinatura e carimba uid/email/nome/data/hash
--      do servidor (não dá pra forjar pelo app). tecnico_id passa a ser auth.uid().
--   4. assinatura_auditoria_maj: trilha append-only SEM FK — sobrevive à exclusão
--      do checklist; a exclusão também vira evento, com cópia do registro apagado.
--      Genérica (documento_tipo) p/ reaproveitar no DDS.
--   5. assinaturas_salvas_maj: assinatura salva só de membros MAJ, separada da do
--      RVT (assinaturas_salvas).
--
--  Tudo aditivo. Não altera registro existente (checklists antigos ficam sem assinatura).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — tipo cinto_talabarte
-- ---------------------------------------------------------------------------
alter table public.equipamentos drop constraint equipamentos_tool_type_check;
alter table public.equipamentos add constraint equipamentos_tool_type_check
  check (tool_type = any (array['furadeira_impacto', 'parafusadeira_comum', 'esmerilhadeira_45', 'esmerilhadeira_7', 'solda', 'cinto_talabarte']));

alter table public.tool_checklists drop constraint tool_checklists_tool_type_check;
alter table public.tool_checklists add constraint tool_checklists_tool_type_check
  check (tool_type = any (array['furadeira_impacto', 'parafusadeira_comum', 'esmerilhadeira_45', 'esmerilhadeira_7', 'solda', 'cinto_talabarte']));

-- ---------------------------------------------------------------------------
-- PASSO 2 — nome/empresa no perfil
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists nome    text;
alter table public.profiles add column if not exists empresa text;

create or replace function public.definir_meu_perfil(p_nome text, p_empresa text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if coalesce(trim(p_nome), '') = '' or coalesce(trim(p_empresa), '') = '' then
    raise exception 'Nome e empresa são obrigatórios.';
  end if;
  update public.profiles
     set nome = left(trim(p_nome), 120), empresa = left(trim(p_empresa), 120)
   where id = auth.uid();
end;
$$;
revoke all on function public.definir_meu_perfil(text, text) from public, anon;
grant execute on function public.definir_meu_perfil(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- PASSO 3 — assinatura no checklist
-- ---------------------------------------------------------------------------
alter table public.tool_checklists add column if not exists assinatura_tipo    text check (assinatura_tipo in ('desenho', 'texto'));
alter table public.tool_checklists add column if not exists assinatura_valor   text;
alter table public.tool_checklists add column if not exists assinatura_origem  text check (assinatura_origem in ('desenho', 'texto', 'salva'));
alter table public.tool_checklists add column if not exists assinatura_hash    text;
alter table public.tool_checklists add column if not exists assinado_por_uid   uuid;
alter table public.tool_checklists add column if not exists assinado_por_email text;
alter table public.tool_checklists add column if not exists assinado_por_nome  text;
alter table public.tool_checklists add column if not exists assinado_em        timestamptz;

-- ---------------------------------------------------------------------------
-- PASSO 4 — trilha de auditoria (append-only, sem FK)
-- ---------------------------------------------------------------------------
create table if not exists public.assinatura_auditoria_maj (
  id                bigint generated always as identity primary key,
  documento_tipo    text not null,              -- 'tool_checklist' | 'dds'
  documento_id      uuid not null,              -- sem FK de propósito: sobrevive à exclusão
  evento            text not null,              -- 'assinada' | 'excluida'
  resumo            text,                       -- ex: "Cinto Paraquedista com Talabarte Y · 01/10/2026"
  assinatura_origem text,
  assinatura_hash   text,
  por_uid           uuid,                       -- quem assinou (assinada) / quem excluiu (excluida)
  por_email         text,
  por_nome          text,
  snapshot          jsonb,                      -- cópia do registro (só no evento 'excluida')
  criado_em         timestamptz not null default now()
);
create index if not exists idx_assinatura_auditoria_maj_doc on public.assinatura_auditoria_maj (documento_tipo, documento_id);

alter table public.assinatura_auditoria_maj enable row level security;
-- Leitura: admin vê tudo, membro vê o que ele mesmo fez. Sem insert/update/delete
-- p/ usuário final => só os triggers (SECURITY DEFINER) escrevem.
drop policy if exists "assinatura_auditoria_maj_select" on public.assinatura_auditoria_maj;
create policy "assinatura_auditoria_maj_select" on public.assinatura_auditoria_maj
  for select using ( is_admin() or por_uid = auth.uid() );

-- ---------------------------------------------------------------------------
-- PASSO 5 — triggers do checklist
-- ---------------------------------------------------------------------------
create or replace function public.tool_checklist_assinar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not is_maj_staff() then
    raise exception 'Somente membros MAJ podem registrar e assinar checklists.';
  end if;
  if coalesce(new.assinatura_valor, '') = '' or new.assinatura_tipo is null then
    raise exception 'Assinatura obrigatória para registrar o checklist.';
  end if;

  -- fonte de verdade = servidor (ignora o que o app mandou nesses campos)
  new.tecnico_id         := auth.uid();
  new.assinado_por_uid   := auth.uid();
  new.assinado_por_email := auth.jwt() ->> 'email';
  new.assinado_por_nome  := (select nome from public.profiles where id = auth.uid());
  new.assinado_em        := now();
  new.assinatura_origem  := coalesce(new.assinatura_origem, new.assinatura_tipo);
  new.assinatura_hash    := encode(digest(new.assinatura_valor, 'sha256'), 'hex');
  return new;
end;
$$;

create or replace function public.tool_checklist_auditar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.assinatura_auditoria_maj
      (documento_tipo, documento_id, evento, resumo, assinatura_origem, assinatura_hash, por_uid, por_email, por_nome)
    values
      ('tool_checklist', new.id, 'assinada',
       new.tool_type || ' · ' || coalesce(new.marca_modelo, '-') || ' · ' || to_char(new.data_checklist, 'DD/MM/YYYY'),
       new.assinatura_origem, new.assinatura_hash, new.assinado_por_uid, new.assinado_por_email, new.assinado_por_nome);
    return new;
  else
    insert into public.assinatura_auditoria_maj
      (documento_tipo, documento_id, evento, resumo, assinatura_origem, assinatura_hash, por_uid, por_email, por_nome, snapshot)
    values
      ('tool_checklist', old.id, 'excluida',
       old.tool_type || ' · ' || coalesce(old.marca_modelo, '-') || ' · ' || to_char(old.data_checklist, 'DD/MM/YYYY'),
       old.assinatura_origem, old.assinatura_hash, auth.uid(), auth.jwt() ->> 'email',
       (select nome from public.profiles where id = auth.uid()),
       to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists trg_tool_checklist_assinar on public.tool_checklists;
create trigger trg_tool_checklist_assinar
  before insert on public.tool_checklists
  for each row execute function public.tool_checklist_assinar();

drop trigger if exists trg_tool_checklist_auditar on public.tool_checklists;
create trigger trg_tool_checklist_auditar
  after insert or delete on public.tool_checklists
  for each row execute function public.tool_checklist_auditar();

-- ---------------------------------------------------------------------------
-- PASSO 6 — assinatura salva MAJ (separada da do RVT)
-- ---------------------------------------------------------------------------
create table if not exists public.assinaturas_salvas_maj (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  tipo          text not null check (tipo in ('desenho', 'texto')),
  valor         text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.assinaturas_salvas_maj enable row level security;

drop policy if exists "assinaturas_salvas_maj_select" on public.assinaturas_salvas_maj;
drop policy if exists "assinaturas_salvas_maj_insert" on public.assinaturas_salvas_maj;
drop policy if exists "assinaturas_salvas_maj_update" on public.assinaturas_salvas_maj;
drop policy if exists "assinaturas_salvas_maj_delete" on public.assinaturas_salvas_maj;

create policy "assinaturas_salvas_maj_select" on public.assinaturas_salvas_maj
  for select using ( user_id = auth.uid() and is_maj_staff() );
create policy "assinaturas_salvas_maj_insert" on public.assinaturas_salvas_maj
  for insert with check ( user_id = auth.uid() and is_maj_staff() );
create policy "assinaturas_salvas_maj_update" on public.assinaturas_salvas_maj
  for update using ( user_id = auth.uid() and is_maj_staff() ) with check ( user_id = auth.uid() and is_maj_staff() );
create policy "assinaturas_salvas_maj_delete" on public.assinaturas_salvas_maj
  for delete using ( user_id = auth.uid() );

commit;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'profiles.nome/empresa' as item, count(*) as ok from information_schema.columns
 where table_name = 'profiles' and column_name in ('nome', 'empresa')
union all
select 'tool_checklists assinatura', count(*) from information_schema.columns
 where table_name = 'tool_checklists' and (column_name like 'assinatura_%' or column_name like 'assinado_%')
union all
select 'triggers checklist', count(*) from pg_trigger where tgname in ('trg_tool_checklist_assinar', 'trg_tool_checklist_auditar')
union all
select 'tabelas novas', count(*) from information_schema.tables
 where table_name in ('assinatura_auditoria_maj', 'assinaturas_salvas_maj');
-- esperado: 2 / 8 / 2 / 2

-- Cadastro dos cintos (preencher marca/modelo/CA e rodar quando tiver os dados):
-- insert into public.equipamentos (tool_type, marca, modelo, especificacoes)
-- values ('cinto_talabarte', 'MARCA', 'MODELO', 'CA 00000');
