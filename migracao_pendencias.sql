-- ============================================================================
--  Migração — Pendências para conclusão (itens em Aguardando/Andamento)
--  Rodar UMA vez no SQL Editor do Supabase, ANTES de subir o build. Sem BOM.
--
--  Entrega:
--   1. pendencias       — 1 linha por pendência (tipo, responsável, detalhe ou
--                         lista de materiais, desde, previsão, baixa)
--   2. pendencia_alvos  — a quais itens a pendência se aplica (1..N corretivas,
--                         ou 1 item avulso "Manutenção não cadastrada" do RVT).
--                         Pendência compartilhada = várias linhas aqui.
--   3. RLS: leitura = quem tem acesso ao cliente; escrita/baixa = só equipe MAJ
--   4. Trigger carimba quem deu baixa (uid/email/nome) pelo servidor
--   5. Trigger apaga a pendência que ficou sem nenhum alvo (ex.: visita cancelada)
--
--  Tudo aditivo. Não altera nenhuma tabela existente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.pendencias (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      text not null references public.clientes(id) on delete cascade,
  tipo            text not null check (tipo in ('material','liberacao','parada_maquina','condicao_seguranca','decisao_cliente','outro')),
  tipo_outro      text,                         -- nome livre quando tipo = 'outro'
  responsavel     text not null check (responsavel in ('cliente','maj')),
  detalhe         text,                         -- texto livre (tipos ≠ material)
  materiais       jsonb not null default '[]'::jsonb,  -- [{item, qtd, unidade, especificacao, marca, obs}]
  desde           date not null default current_date,
  previsao        date,
  origem_rvt_id   uuid references public.rvts(id) on delete set null,
  baixa_em        date,
  baixa_obs       text,
  baixa_rvt_id    uuid references public.rvts(id) on delete set null,
  baixa_por_uid   uuid,
  baixa_por_email text,
  baixa_por_nome  text,
  criado_em       timestamptz not null default now(),
  criado_por_uid  uuid default auth.uid(),
  atualizado_em   timestamptz not null default now()
);

create table if not exists public.pendencia_alvos (
  id              uuid primary key default gen_random_uuid(),
  pendencia_id    uuid not null references public.pendencias(id) on delete cascade,
  cliente_id      text not null references public.clientes(id) on delete cascade,
  atendimento_id  uuid references public.atendimentos(id) on delete cascade,
  rvt_item_id     uuid references public.rvt_itens(id) on delete cascade,
  constraint pendencia_alvos_alvo_unico_check check (num_nonnulls(atendimento_id, rvt_item_id) = 1)
);

create unique index if not exists pendencia_alvos_atendimento_uq on public.pendencia_alvos (pendencia_id, atendimento_id) where atendimento_id is not null;
create unique index if not exists pendencia_alvos_rvt_item_uq   on public.pendencia_alvos (pendencia_id, rvt_item_id)   where rvt_item_id is not null;
create index if not exists pendencias_cliente_idx          on public.pendencias (cliente_id);
create index if not exists pendencia_alvos_pendencia_idx   on public.pendencia_alvos (pendencia_id);
create index if not exists pendencia_alvos_atendimento_idx on public.pendencia_alvos (atendimento_id);
create index if not exists pendencia_alvos_rvt_item_idx    on public.pendencia_alvos (rvt_item_id);
create index if not exists pendencia_alvos_cliente_idx     on public.pendencia_alvos (cliente_id);

-- ---------------------------------------------------------------------------
-- PASSO 2 — RLS
-- ---------------------------------------------------------------------------
alter table public.pendencias      enable row level security;
alter table public.pendencia_alvos enable row level security;

drop policy if exists pendencias_select on public.pendencias;
drop policy if exists pendencias_insert on public.pendencias;
drop policy if exists pendencias_update on public.pendencias;
drop policy if exists pendencias_delete on public.pendencias;
create policy pendencias_select on public.pendencias for select using (has_client_access(cliente_id));
create policy pendencias_insert on public.pendencias for insert with check (is_maj_staff() and has_client_access(cliente_id));
create policy pendencias_update on public.pendencias for update using (is_maj_staff() and has_client_access(cliente_id)) with check (is_maj_staff() and has_client_access(cliente_id));
create policy pendencias_delete on public.pendencias for delete using (is_maj_staff() and has_client_access(cliente_id));

drop policy if exists pendencia_alvos_select on public.pendencia_alvos;
drop policy if exists pendencia_alvos_insert on public.pendencia_alvos;
drop policy if exists pendencia_alvos_update on public.pendencia_alvos;
drop policy if exists pendencia_alvos_delete on public.pendencia_alvos;
create policy pendencia_alvos_select on public.pendencia_alvos for select using (has_client_access(cliente_id));
create policy pendencia_alvos_insert on public.pendencia_alvos for insert with check (is_maj_staff() and has_client_access(cliente_id));
create policy pendencia_alvos_update on public.pendencia_alvos for update using (is_maj_staff() and has_client_access(cliente_id)) with check (is_maj_staff() and has_client_access(cliente_id));
create policy pendencia_alvos_delete on public.pendencia_alvos for delete using (is_maj_staff() and has_client_access(cliente_id));

-- ---------------------------------------------------------------------------
-- PASSO 3 — carimbo da baixa (servidor) + atualizado_em
-- ---------------------------------------------------------------------------
create or replace function public.pendencia_carimbo()
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
  if new.baixa_em is null then
    new.baixa_obs := null; new.baixa_rvt_id := null;
    new.baixa_por_uid := null; new.baixa_por_email := null; new.baixa_por_nome := null;
  elsif tg_op = 'INSERT' or old.baixa_em is null then
    new.baixa_por_uid   := auth.uid();
    new.baixa_por_email := auth.jwt() ->> 'email';
    new.baixa_por_nome  := (select nome from public.profiles where id = auth.uid());
  else
    -- baixa já dada: quem deu não muda
    new.baixa_por_uid := old.baixa_por_uid; new.baixa_por_email := old.baixa_por_email; new.baixa_por_nome := old.baixa_por_nome;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pendencia_carimbo on public.pendencias;
create trigger trg_pendencia_carimbo
  before insert or update on public.pendencias
  for each row execute function public.pendencia_carimbo();

-- ---------------------------------------------------------------------------
-- PASSO 4 — pendência sem nenhum alvo some junto (visita cancelada, item apagado)
-- ---------------------------------------------------------------------------
create or replace function public.pendencia_limpa_orfa()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  delete from public.pendencias p
   where p.id = old.pendencia_id
     and not exists (select 1 from public.pendencia_alvos a where a.pendencia_id = old.pendencia_id);
  return null;
end;
$$;

drop trigger if exists trg_pendencia_limpa_orfa on public.pendencia_alvos;
create trigger trg_pendencia_limpa_orfa
  after delete on public.pendencia_alvos
  for each row execute function public.pendencia_limpa_orfa();

commit;

-- ---------------------------------------------------------------------------
-- Verificação — esperado: 2 / 8 / 2
-- ---------------------------------------------------------------------------
select 'tabelas' as item, count(*) as ok from information_schema.tables
 where table_schema = 'public' and table_name in ('pendencias', 'pendencia_alvos')
union all
select 'policies', count(*) from pg_policies where tablename in ('pendencias', 'pendencia_alvos')
union all
select 'triggers', count(*) from pg_trigger where tgname in ('trg_pendencia_carimbo', 'trg_pendencia_limpa_orfa');
