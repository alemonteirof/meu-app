-- ============================================================================
--  Migração — OPS (Observação Preventiva de Segurança — modelo Nissan terceiros)
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--  Depende de migracao_checklist_assinatura_maj.sql (assinatura_auditoria_maj,
--  is_maj_staff(), is_admin(), profiles.nome).
--
--  Entrega:
--   1. ops_registros: 1 linha por OPS. Só membros MAJ (admin/operador) veem/criam.
--      Observador = quem assina (uid/email/nome/data/sha256 carimbados por trigger).
--      semana_iso/ano_iso calculados da data_ops no servidor.
--   2. Correção: o observador (ou admin) pode editar a qualquer momento os campos
--      do formulário. Autoria e assinatura original NUNCA mudam (trigger trava).
--      Cada correção vira evento 'corrigida' com snapshot do ANTES na trilha.
--   3. Excluir: só admin; evento 'excluida' com snapshot.
--   4. Trilha em assinatura_auditoria_maj (documento_tipo = 'ops').
--   5. RPC ops_membros_maj(): lista id/nome dos membros MAJ p/ o campo
--      "Funcionário observado" (operador não lê profiles de outros).
--
--  id é uuid (e não uid() curto) porque assinatura_auditoria_maj.documento_id é uuid.
--  Tudo aditivo. Não altera nenhuma tabela existente.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — validação das respostas (18 itens, cada um sim/nao/na)
-- ---------------------------------------------------------------------------
create or replace function public.ops_respostas_validas(r jsonb)
  returns boolean
  language sql
  immutable
  set search_path = public
as $$
  select jsonb_typeof(r) = 'object'
     and (select count(*) from jsonb_object_keys(r)) = 18
     and (select bool_and(r ->> i::text in ('sim', 'nao', 'na')) from generate_series(1, 18) as i);
$$;

-- ---------------------------------------------------------------------------
-- PASSO 2 — tabela
-- ---------------------------------------------------------------------------
create table if not exists public.ops_registros (
  id                          uuid primary key default gen_random_uuid(),
  data_ops                    date not null,
  semana_iso                  int,                     -- calculada pelo trigger (nome do arquivo "OPS SEMANA XX")
  ano_iso                     int,                     -- calculado pelo trigger (semana 1 pode cair em dez/jan)
  funcionario_observado       text not null check (length(btrim(funcionario_observado)) > 0),
  funcionario_observado_uid   uuid,                    -- se for usuário do app
  predio                      text not null check (length(btrim(predio)) > 0),
  empresa                     text not null default 'MAJ SOLUÇÕES',
  respostas                   jsonb not null check (public.ops_respostas_validas(respostas)),
  comportamentos_preventivos  text not null check (length(btrim(comportamentos_preventivos)) > 0),
  atos_inseguros              text not null check (length(btrim(atos_inseguros)) > 0),
  condicoes_inseguras         text not null check (length(btrim(condicoes_inseguras)) > 0),
  form_versao                 text not null default 'nissan-terceiros-v1',  -- textos vivem em src/lib/opsItens.js
  assinatura_tipo             text not null check (assinatura_tipo in ('desenho', 'texto')),
  assinatura_valor            text not null,
  assinatura_origem           text check (assinatura_origem in ('desenho', 'texto', 'salva', 'importada')),
  assinatura_hash             text,
  observador_uid              uuid,
  observador_email            text,
  observador_nome             text,
  assinado_em                 timestamptz not null default now(),
  corrigido_por_uid           uuid,
  corrigido_por_nome          text,
  corrigido_em                timestamptz
);
create index if not exists idx_ops_registros_data on public.ops_registros (data_ops desc);
create index if not exists idx_ops_registros_semana on public.ops_registros (ano_iso, semana_iso);

-- ---------------------------------------------------------------------------
-- PASSO 3 — trigger BEFORE INSERT/UPDATE (carimbo + trava de autoria)
-- ---------------------------------------------------------------------------
create or replace function public.ops_assinar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not is_maj_staff() then
    raise exception 'Somente membros MAJ podem registrar ou corrigir OPS.';
  end if;

  -- sempre calculados no servidor
  new.semana_iso := extract(week from new.data_ops)::int;
  new.ano_iso    := extract(isoyear from new.data_ops)::int;
  new.empresa    := 'MAJ SOLUÇÕES';

  if tg_op = 'INSERT' then
    if coalesce(new.assinatura_valor, '') = '' or new.assinatura_tipo is null then
      raise exception 'Assinatura do observador obrigatória.';
    end if;
    -- fonte de verdade = servidor (ignora o que o app mandou nesses campos)
    new.observador_uid     := auth.uid();
    new.observador_email   := auth.jwt() ->> 'email';
    new.observador_nome    := (select nome from public.profiles where id = auth.uid());
    new.assinado_em        := now();
    new.assinatura_origem  := coalesce(new.assinatura_origem, new.assinatura_tipo);
    new.assinatura_hash    := encode(digest(new.assinatura_valor, 'sha256'), 'hex');
    new.corrigido_por_uid  := null; new.corrigido_por_nome := null; new.corrigido_em := null;
    return new;
  end if;

  -- UPDATE (correção): só o observador ou admin
  if old.observador_uid is distinct from auth.uid() and not is_admin() then
    raise exception 'Só quem registrou o OPS (ou um administrador) pode corrigi-lo.';
  end if;

  -- autoria e assinatura original nunca mudam
  new.id                := old.id;
  new.observador_uid    := old.observador_uid;
  new.observador_email  := old.observador_email;
  new.observador_nome   := old.observador_nome;
  new.assinado_em       := old.assinado_em;
  new.assinatura_tipo   := old.assinatura_tipo;
  new.assinatura_valor  := old.assinatura_valor;
  new.assinatura_origem := old.assinatura_origem;
  new.assinatura_hash   := old.assinatura_hash;
  new.form_versao       := old.form_versao;

  new.corrigido_por_uid  := auth.uid();
  new.corrigido_por_nome := coalesce((select nome from public.profiles where id = auth.uid()), auth.jwt() ->> 'email');
  new.corrigido_em       := now();
  return new;
end;
$$;

drop trigger if exists trg_ops_assinar on public.ops_registros;
create trigger trg_ops_assinar
  before insert or update on public.ops_registros
  for each row execute function public.ops_assinar();

-- ---------------------------------------------------------------------------
-- PASSO 4 — trilha (assinada / corrigida / excluida)
-- ---------------------------------------------------------------------------
create or replace function public.ops_auditar()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r public.ops_registros;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.assinatura_auditoria_maj
    (documento_tipo, documento_id, evento, resumo, assinatura_origem, assinatura_hash, por_uid, por_email, por_nome, snapshot)
  values
    ('ops', r.id,
     case when tg_op = 'INSERT' then 'assinada' when tg_op = 'UPDATE' then 'corrigida' else 'excluida' end,
     'OPS semana ' || r.semana_iso || ' · ' || to_char(r.data_ops, 'DD/MM/YYYY') || ' · ' || r.funcionario_observado || ' · ' || r.predio,
     r.assinatura_origem, r.assinatura_hash,
     case when tg_op = 'INSERT' then new.observador_uid else auth.uid() end,
     case when tg_op = 'INSERT' then new.observador_email else auth.jwt() ->> 'email' end,
     case when tg_op = 'INSERT' then new.observador_nome else (select nome from public.profiles where id = auth.uid()) end,
     -- snapshot = como o registro estava ANTES (correção/exclusão); sem a imagem da assinatura (já tem o hash)
     case when tg_op = 'INSERT' then null else to_jsonb(old) - 'assinatura_valor' end);
  return r;
end;
$$;

drop trigger if exists trg_ops_auditar on public.ops_registros;
create trigger trg_ops_auditar
  after insert or update or delete on public.ops_registros
  for each row execute function public.ops_auditar();

-- ---------------------------------------------------------------------------
-- PASSO 5 — RLS (só membros MAJ; cliente/visualizador não vê nada)
-- ---------------------------------------------------------------------------
alter table public.ops_registros enable row level security;

drop policy if exists "ops_registros_select" on public.ops_registros;
drop policy if exists "ops_registros_insert" on public.ops_registros;
drop policy if exists "ops_registros_update" on public.ops_registros;
drop policy if exists "ops_registros_delete" on public.ops_registros;
create policy "ops_registros_select" on public.ops_registros for select using ( is_maj_staff() );
create policy "ops_registros_insert" on public.ops_registros for insert with check ( is_maj_staff() );
create policy "ops_registros_update" on public.ops_registros for update
  using ( is_maj_staff() and (observador_uid = auth.uid() or is_admin()) )
  with check ( is_maj_staff() );
create policy "ops_registros_delete" on public.ops_registros for delete using ( is_admin() );

-- ---------------------------------------------------------------------------
-- PASSO 6 — lista de membros MAJ (campo "Funcionário observado")
-- ---------------------------------------------------------------------------
create or replace function public.ops_membros_maj()
  returns table (id uuid, nome text)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.nome), ''), p.email)
    from public.profiles p
   where is_maj_staff()
     and p.role in ('admin', 'operador')
   order by 2;
$$;
revoke all on function public.ops_membros_maj() from public, anon;
grant execute on function public.ops_membros_maj() to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'tabela ops' as item, count(*) as ok from information_schema.tables
 where table_schema = 'public' and table_name = 'ops_registros'
union all
select 'triggers ops', count(*) from pg_trigger where tgname in ('trg_ops_assinar', 'trg_ops_auditar')
union all
select 'policies ops', count(*) from pg_policies where tablename = 'ops_registros'
union all
select 'funcoes ops', count(*) from pg_proc
 where proname in ('ops_respostas_validas', 'ops_assinar', 'ops_auditar', 'ops_membros_maj') and pronamespace = 'public'::regnamespace;
-- esperado: 1 / 2 / 4 / 4
