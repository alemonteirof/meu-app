-- ============================================================================
--  Migração — OPS página 2 + assinatura opcional (2026-11-04)
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--  Depende de migracao_ops.sql.
--
--  Decisões do Alexandre (04/11/2026):
--   1. O PDF entregue é o modelo oficial Nissan, fiel, com as 2 páginas. A página 2
--      (Entrevista operador / Quais são os riscos? / Medidas corretivas) vira dados:
--      conhece_perigos_riscos, riscos, medidas.
--   2. Sem assinatura digital obrigatória: o OPS é impresso e assinado no papel
--      ("Assinatura do funcionário auditado", página 2). assinatura_* ficam opcionais.
--      Observador/data continuam carimbados pelo trigger (login).
--
--  ops_registros estava VAZIA quando esta migração foi escrita (0 linhas em
--  04/11/2026), por isso as colunas novas já nascem NOT NULL.
--  Aditivo: não apaga dados nem colunas.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — página 2
-- ---------------------------------------------------------------------------
alter table public.ops_registros
  add column if not exists conhece_perigos_riscos text not null default 'sim'
    check (conhece_perigos_riscos in ('sim', 'nao')),
  add column if not exists riscos text not null default '',
  add column if not exists medidas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(medidas) = 'array' and jsonb_array_length(medidas) <= 10);

-- sem valor padrão daqui pra frente: o app sempre manda (nenhum pré-marcado)
alter table public.ops_registros alter column conhece_perigos_riscos drop default;
alter table public.ops_registros alter column riscos drop default;

alter table public.ops_registros drop constraint if exists ops_registros_riscos_preenchido;
alter table public.ops_registros add constraint ops_registros_riscos_preenchido
  check (length(btrim(riscos)) > 0);

-- ---------------------------------------------------------------------------
-- PASSO 2 — assinatura opcional
-- ---------------------------------------------------------------------------
alter table public.ops_registros alter column assinatura_tipo drop not null;
alter table public.ops_registros alter column assinatura_valor drop not null;

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
    -- assinatura digital é opcional (o OPS é assinado no papel); se vier, fica registrada
    if coalesce(new.assinatura_valor, '') = '' then
      new.assinatura_tipo := null; new.assinatura_valor := null;
      new.assinatura_origem := null; new.assinatura_hash := null;
    else
      new.assinatura_origem := coalesce(new.assinatura_origem, new.assinatura_tipo);
      new.assinatura_hash   := encode(digest(new.assinatura_valor, 'sha256'), 'hex');
    end if;
    -- fonte de verdade = servidor (ignora o que o app mandou nesses campos)
    new.observador_uid     := auth.uid();
    new.observador_email   := auth.jwt() ->> 'email';
    new.observador_nome    := (select nome from public.profiles where id = auth.uid());
    new.assinado_em        := now();   -- = data/hora do registro
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

-- trilha: 'registrada' quando não há assinatura digital (antes sempre 'assinada')
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
     case when tg_op = 'INSERT' then (case when r.assinatura_hash is null then 'registrada' else 'assinada' end)
          when tg_op = 'UPDATE' then 'corrigida' else 'excluida' end,
     'OPS semana ' || r.semana_iso || ' · ' || to_char(r.data_ops, 'DD/MM/YYYY') || ' · ' || r.funcionario_observado || ' · ' || r.predio,
     r.assinatura_origem, r.assinatura_hash,
     case when tg_op = 'INSERT' then new.observador_uid else auth.uid() end,
     case when tg_op = 'INSERT' then new.observador_email else auth.jwt() ->> 'email' end,
     case when tg_op = 'INSERT' then new.observador_nome else (select nome from public.profiles where id = auth.uid()) end,
     case when tg_op = 'INSERT' then null else to_jsonb(old) - 'assinatura_valor' end);
  return r;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
select 'colunas pagina 2' as item, count(*) as ok from information_schema.columns
 where table_schema = 'public' and table_name = 'ops_registros'
   and column_name in ('conhece_perigos_riscos', 'riscos', 'medidas')
union all
select 'assinatura opcional', count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'ops_registros'
   and column_name in ('assinatura_tipo', 'assinatura_valor') and is_nullable = 'YES'
union all
select 'trigger sem exigir assinatura', count(*) from pg_proc
 where proname = 'ops_assinar' and pronamespace = 'public'::regnamespace
   and position('Assinatura do observador obrigat' in pg_get_functiondef(oid)) = 0;
-- esperado: 3 / 2 / 1
