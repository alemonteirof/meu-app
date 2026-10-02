-- ============================================================================
--  Migração — DDS (Diálogo Diário de Segurança) com lista de presença assinada
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--  Depende de migracao_checklist_assinatura_maj.sql (assinatura_auditoria_maj,
--  is_maj_staff(), profiles.nome).
--
--  Entrega:
--   1. dds_sessoes: 1 linha por DDS aberto (tema, data, local). Qualquer membro
--      MAJ (admin/operador) abre; quem abriu (ou admin) encerra. Encerrado trava.
--   2. dds_assinaturas: 1 assinatura por participante (login) por DDS. Cada um
--      assina com o PRÓPRIO login — uid/email/nome/data/hash carimbados por
--      trigger (não dá pra assinar por outra pessoa). Só aceita com DDS aberto.
--   3. Trilha em assinatura_auditoria_maj (documento_tipo = 'dds',
--      documento_id = id do DDS) — sobrevive à exclusão, com snapshot.
--
--  Tudo aditivo. Não altera nenhuma tabela existente.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.dds_sessoes (
  id                  uuid primary key default gen_random_uuid(),
  tema_codigo         text not null,              -- ex: 'DDS-07' (conteúdo vive em src/lib/ddsTemas.js)
  tema_titulo         text not null,              -- cópia do título no momento da abertura
  data_dds            date not null default current_date,
  local               text,
  observacoes         text,
  status              text not null default 'aberto' check (status in ('aberto', 'encerrado')),
  criado_por_uid      uuid,
  criado_por_email    text,
  criado_por_nome     text,
  criado_em           timestamptz not null default now(),
  encerrado_por_uid   uuid,
  encerrado_por_nome  text,
  encerrado_em        timestamptz
);
create index if not exists idx_dds_sessoes_status on public.dds_sessoes (status, criado_em desc);

create table if not exists public.dds_assinaturas (
  id                  uuid primary key default gen_random_uuid(),
  dds_id              uuid not null references public.dds_sessoes(id) on delete cascade,
  assinatura_tipo     text not null check (assinatura_tipo in ('desenho', 'texto')),
  assinatura_valor    text not null,
  assinatura_origem   text check (assinatura_origem in ('desenho', 'texto', 'salva', 'importada')),
  assinatura_hash     text,
  assinado_por_uid    uuid not null default auth.uid(),
  assinado_por_email  text,
  assinado_por_nome   text,
  assinado_em         timestamptz not null default now(),
  unique (dds_id, assinado_por_uid)
);
create index if not exists idx_dds_assinaturas_dds on public.dds_assinaturas (dds_id);

-- ---------------------------------------------------------------------------
-- PASSO 2 — triggers do DDS (abertura / encerramento)
-- ---------------------------------------------------------------------------
create or replace function public.dds_sessao_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not is_maj_staff() then
    raise exception 'Somente membros MAJ podem abrir ou encerrar DDS.';
  end if;

  if tg_op = 'INSERT' then
    new.status           := 'aberto';
    new.criado_por_uid   := auth.uid();
    new.criado_por_email := auth.jwt() ->> 'email';
    new.criado_por_nome  := (select nome from public.profiles where id = auth.uid());
    new.criado_em        := now();
    new.encerrado_por_uid := null; new.encerrado_por_nome := null; new.encerrado_em := null;
    return new;
  end if;

  -- UPDATE: só quem abriu ou admin; encerrado não muda mais
  if old.status = 'encerrado' then
    raise exception 'Este DDS já foi encerrado e não pode ser alterado.';
  end if;
  if old.criado_por_uid is distinct from auth.uid() and not is_admin() then
    raise exception 'Só quem abriu o DDS (ou um administrador) pode alterá-lo.';
  end if;

  -- campos de autoria nunca mudam
  new.id := old.id;
  new.criado_por_uid := old.criado_por_uid; new.criado_por_email := old.criado_por_email;
  new.criado_por_nome := old.criado_por_nome; new.criado_em := old.criado_em;

  if new.status = 'encerrado' then
    new.encerrado_por_uid  := auth.uid();
    new.encerrado_por_nome := (select nome from public.profiles where id = auth.uid());
    new.encerrado_em       := now();
  else
    new.encerrado_por_uid := null; new.encerrado_por_nome := null; new.encerrado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dds_sessao_guard on public.dds_sessoes;
create trigger trg_dds_sessao_guard
  before insert or update on public.dds_sessoes
  for each row execute function public.dds_sessao_guard();

create or replace function public.dds_sessao_auditar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.assinatura_auditoria_maj
    (documento_tipo, documento_id, evento, resumo, por_uid, por_email, por_nome, snapshot)
  values
    ('dds', coalesce(new.id, old.id),
     case when tg_op = 'INSERT' then 'aberto'
          when tg_op = 'DELETE' then 'excluida'
          else 'encerrado' end,
     coalesce(new.tema_codigo, old.tema_codigo) || ' · ' || coalesce(new.tema_titulo, old.tema_titulo)
       || ' · ' || to_char(coalesce(new.data_dds, old.data_dds), 'DD/MM/YYYY'),
     auth.uid(), auth.jwt() ->> 'email',
     (select nome from public.profiles where id = auth.uid()),
     case when tg_op = 'DELETE' then to_jsonb(old) end);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_dds_sessao_auditar on public.dds_sessoes;
create trigger trg_dds_sessao_auditar
  after insert or delete or update of status on public.dds_sessoes
  for each row execute function public.dds_sessao_auditar();

-- ---------------------------------------------------------------------------
-- PASSO 3 — triggers da assinatura de presença
-- ---------------------------------------------------------------------------
create or replace function public.dds_assinar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not is_maj_staff() then
    raise exception 'Somente membros MAJ podem assinar o DDS.';
  end if;
  if not exists (select 1 from public.dds_sessoes where id = new.dds_id and status = 'aberto') then
    raise exception 'Este DDS já foi encerrado — não aceita mais assinaturas.';
  end if;
  if coalesce(new.assinatura_valor, '') = '' or new.assinatura_tipo is null then
    raise exception 'Assinatura obrigatória.';
  end if;

  -- fonte de verdade = servidor (ignora o que o app mandou nesses campos)
  new.assinado_por_uid   := auth.uid();
  new.assinado_por_email := auth.jwt() ->> 'email';
  new.assinado_por_nome  := (select nome from public.profiles where id = auth.uid());
  new.assinado_em        := now();
  new.assinatura_origem  := coalesce(new.assinatura_origem, new.assinatura_tipo);
  new.assinatura_hash    := encode(digest(new.assinatura_valor, 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists trg_dds_assinar on public.dds_assinaturas;
create trigger trg_dds_assinar
  before insert on public.dds_assinaturas
  for each row execute function public.dds_assinar();

create or replace function public.dds_assinatura_auditar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_resumo text;
begin
  select tema_codigo || ' · ' || tema_titulo || ' · ' || to_char(data_dds, 'DD/MM/YYYY')
    into v_resumo from public.dds_sessoes where id = coalesce(new.dds_id, old.dds_id);
  -- na exclusão em cascata o DDS pai já sumiu; o snapshot guarda o resto
  v_resumo := coalesce(v_resumo, 'DDS excluído');

  if tg_op = 'INSERT' then
    insert into public.assinatura_auditoria_maj
      (documento_tipo, documento_id, evento, resumo, assinatura_origem, assinatura_hash, por_uid, por_email, por_nome)
    values
      ('dds', new.dds_id, 'assinada', v_resumo,
       new.assinatura_origem, new.assinatura_hash, new.assinado_por_uid, new.assinado_por_email, new.assinado_por_nome);
    return new;
  else
    insert into public.assinatura_auditoria_maj
      (documento_tipo, documento_id, evento, resumo, assinatura_origem, assinatura_hash, por_uid, por_email, por_nome, snapshot)
    values
      ('dds', old.dds_id, 'assinatura_excluida', v_resumo,
       old.assinatura_origem, old.assinatura_hash, auth.uid(), auth.jwt() ->> 'email',
       (select nome from public.profiles where id = auth.uid()),
       to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists trg_dds_assinatura_auditar on public.dds_assinaturas;
create trigger trg_dds_assinatura_auditar
  after insert or delete on public.dds_assinaturas
  for each row execute function public.dds_assinatura_auditar();

-- ---------------------------------------------------------------------------
-- PASSO 4 — RLS (só membros MAJ; cliente/visualizador não vê nada)
-- ---------------------------------------------------------------------------
alter table public.dds_sessoes     enable row level security;
alter table public.dds_assinaturas enable row level security;

drop policy if exists "dds_sessoes_select" on public.dds_sessoes;
drop policy if exists "dds_sessoes_insert" on public.dds_sessoes;
drop policy if exists "dds_sessoes_update" on public.dds_sessoes;
drop policy if exists "dds_sessoes_delete" on public.dds_sessoes;
create policy "dds_sessoes_select" on public.dds_sessoes for select using ( is_maj_staff() );
create policy "dds_sessoes_insert" on public.dds_sessoes for insert with check ( is_maj_staff() );
create policy "dds_sessoes_update" on public.dds_sessoes for update
  using ( is_maj_staff() and (criado_por_uid = auth.uid() or is_admin()) )
  with check ( is_maj_staff() );
create policy "dds_sessoes_delete" on public.dds_sessoes for delete using ( is_admin() );

-- Assinatura: lê quem é MAJ; insere só a própria (trigger força o uid);
-- sem update/delete pelo app (só some junto com o DDS, via cascade, por admin).
drop policy if exists "dds_assinaturas_select" on public.dds_assinaturas;
drop policy if exists "dds_assinaturas_insert" on public.dds_assinaturas;
create policy "dds_assinaturas_select" on public.dds_assinaturas for select using ( is_maj_staff() );
create policy "dds_assinaturas_insert" on public.dds_assinaturas for insert with check ( is_maj_staff() );

commit;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'tabelas dds' as item, count(*) as ok from information_schema.tables
 where table_schema = 'public' and table_name in ('dds_sessoes', 'dds_assinaturas')
union all
select 'triggers dds', count(*) from pg_trigger
 where tgname in ('trg_dds_sessao_guard', 'trg_dds_sessao_auditar', 'trg_dds_assinar', 'trg_dds_assinatura_auditar')
union all
select 'policies dds', count(*) from pg_policies where tablename in ('dds_sessoes', 'dds_assinaturas');
-- esperado: 2 / 4 / 6
