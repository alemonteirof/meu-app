-- ============================================================================
--  Migração — Solução provisória + Não conformidades (NC)
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--
--  1. atendimento_intervencoes: provisoria + falta_definitiva (Solução provisória)
--  2. nao_conformidades: tabela nova (cliente vê; só equipe MAJ grava)
--  3. pendencia_alvos: alvo pode ser uma NC (reaproveita as pendências)
--  Tudo aditivo — não altera registro existente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — Solução provisória na intervenção
-- ---------------------------------------------------------------------------
alter table public.atendimento_intervencoes add column if not exists provisoria boolean not null default false;
alter table public.atendimento_intervencoes add column if not exists falta_definitiva text;

-- ---------------------------------------------------------------------------
-- PASSO 2 — Não conformidades
-- ---------------------------------------------------------------------------
create table if not exists public.nao_conformidades (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         text not null references public.clientes(id) on delete cascade,
  rvt_id             uuid references public.rvts(id) on delete set null,
  classificacao      text not null check (classificacao in ('normativa','regras_internas','seguradora')),
  norma              text,
  norma_item         text,
  titulo             text not null,
  descricao          text,
  local_texto        text,
  painel_id          text references public.paineis(id) on delete set null,
  dispositivo_id     text references public.dispositivos(id) on delete set null,
  risco              text check (risco is null or risco in ('alto','medio','baixo')),
  recomendacao       text,
  fotos              jsonb not null default '[]'::jsonb,
  data_constatacao   date not null default current_date,
  status             text not null default 'aberta' check (status in ('aberta','em_tratamento','encerrada')),
  encerrada_em       date,
  solucao            text,
  fotos_solucao      jsonb not null default '[]'::jsonb,
  encerrada_por_uid  uuid,
  encerrada_por_email text,
  encerrada_por_nome text,
  origem_conversao   jsonb,          -- snapshot das corretivas convertidas em NC (tela temporária)
  criado_em          timestamptz not null default now(),
  criado_por_uid     uuid default auth.uid(),
  atualizado_em      timestamptz not null default now()
);
create index if not exists nao_conformidades_cliente_idx on public.nao_conformidades (cliente_id);
create index if not exists nao_conformidades_rvt_idx on public.nao_conformidades (rvt_id);

alter table public.nao_conformidades enable row level security;
drop policy if exists nao_conformidades_select on public.nao_conformidades;
drop policy if exists nao_conformidades_insert on public.nao_conformidades;
drop policy if exists nao_conformidades_update on public.nao_conformidades;
drop policy if exists nao_conformidades_delete on public.nao_conformidades;
create policy nao_conformidades_select on public.nao_conformidades for select using (has_client_access(cliente_id));
create policy nao_conformidades_insert on public.nao_conformidades for insert with check (is_maj_staff() and has_client_access(cliente_id));
create policy nao_conformidades_update on public.nao_conformidades for update using (is_maj_staff() and has_client_access(cliente_id)) with check (is_maj_staff() and has_client_access(cliente_id));
create policy nao_conformidades_delete on public.nao_conformidades for delete using (is_maj_staff() and has_client_access(cliente_id));

-- Carimbo do encerramento pelo servidor (quem encerrou não é forjável pelo app)
create or replace function public.nao_conformidade_carimbo()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.criado_por_uid := auth.uid();
  end if;
  if new.status <> 'encerrada' then
    new.encerrada_em := null; new.encerrada_por_uid := null; new.encerrada_por_email := null; new.encerrada_por_nome := null;
  elsif tg_op = 'INSERT' or old.status <> 'encerrada' then
    new.encerrada_em        := coalesce(new.encerrada_em, current_date);
    new.encerrada_por_uid   := auth.uid();
    new.encerrada_por_email := auth.jwt() ->> 'email';
    new.encerrada_por_nome  := (select nome from public.profiles where id = auth.uid());
  else
    new.encerrada_por_uid := old.encerrada_por_uid; new.encerrada_por_email := old.encerrada_por_email; new.encerrada_por_nome := old.encerrada_por_nome;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nao_conformidade_carimbo on public.nao_conformidades;
create trigger trg_nao_conformidade_carimbo
  before insert or update on public.nao_conformidades
  for each row execute function public.nao_conformidade_carimbo();

-- ---------------------------------------------------------------------------
-- PASSO 3 — Pendência pode ter uma NC como alvo
-- ---------------------------------------------------------------------------
alter table public.pendencia_alvos add column if not exists nao_conformidade_id uuid references public.nao_conformidades(id) on delete cascade;
alter table public.pendencia_alvos drop constraint if exists pendencia_alvos_alvo_unico_check;
alter table public.pendencia_alvos add constraint pendencia_alvos_alvo_unico_check
  check (num_nonnulls(atendimento_id, rvt_item_id, nao_conformidade_id) = 1);
create unique index if not exists pendencia_alvos_nc_uq on public.pendencia_alvos (pendencia_id, nao_conformidade_id) where nao_conformidade_id is not null;
create index if not exists pendencia_alvos_nc_idx on public.pendencia_alvos (nao_conformidade_id);

-- ---------------------------------------------------------------------------
-- PASSO 4 — BUG ANTIGO corrigido (achado no teste de 2026-10-04): o CHECK `um_dos_tres` de
-- rvt_itens só aceitava atendimento/inspeção/outro_descricao — recusava item de INTERVENÇÃO
-- ("Registrar intervenção" nunca gravou o item no RVT) e item "Outro" só com atividade
-- (Diagnóstico sem texto). Agora: exatamente 1 de atendimento/inspeção/intervenção/outro.
-- ---------------------------------------------------------------------------
alter table public.rvt_itens drop constraint if exists um_dos_tres;
alter table public.rvt_itens add constraint um_dos_tres
  check (num_nonnulls(atendimento_id, inspecao_id, intervencao_id, coalesce(outro_descricao, outro_atividade)) = 1);

commit;

-- ---------------------------------------------------------------------------
-- Verificação — esperado: 2 / 1 / 4 / 1 / 1
-- ---------------------------------------------------------------------------
select 'intervencoes provisoria' as item, count(*) as ok from information_schema.columns
 where table_name = 'atendimento_intervencoes' and column_name in ('provisoria', 'falta_definitiva')
union all
select 'tabela nao_conformidades', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'nao_conformidades'
union all
select 'policies nc', count(*) from pg_policies where tablename = 'nao_conformidades'
union all
select 'trigger nc', count(*) from pg_trigger where tgname = 'trg_nao_conformidade_carimbo'
union all
select 'pendencia_alvos.nc', count(*) from information_schema.columns where table_name = 'pendencia_alvos' and column_name = 'nao_conformidade_id';
