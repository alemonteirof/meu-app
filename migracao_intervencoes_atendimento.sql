-- ============================================================================
--  Migração — Intervenções em corretiva (histórico de tentativas/solução)
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Contexto: a migração anterior (migracao_pendencias_resolvidas_outra_visita.sql)
--  só permitia MARCAR uma corretiva pendente como Resolvido a partir de outra
--  visita, sem espaço pra registrar o que foi feito, como foi feito e fotos —
--  e sem sobrescrever o relato original do problema. Esta migração resolve isso:
--
--  1. atendimento_intervencoes: 1 corretiva pode acumular VÁRIAS intervenções ao
--     longo de visitas diferentes (ex: visita 1 tenta um ajuste e fica
--     "Andamento", visita 2 registra a solução final e fecha "Resolvido") — cada
--     uma com sua própria data/visita/técnico/descrição/fotos. Nunca sobrescreve
--     falha/descritivo/fotos do atendimento original.
--  2. rvt_itens ganha intervencao_id — assim uma intervenção aparece como item
--     da visita em que foi registrada (mesmo mecanismo já usado por
--     atendimento_id/inspecao_id/outro_*), mostrando problema original + solução
--     juntos no relatório.
--  3. RLS: só leitura (is_admin()/has_client_access) + insert; SEM update/delete
--     pelo usuário final — mesma política "append-only" de assinatura_auditoria/
--     combate_historico (histórico não se edita/apaga).
--
--  Tudo aditivo. Não altera nenhuma tabela/coluna/policy existente.
-- ============================================================================

-- gen_random_uuid() vem do pgcrypto (já habilitado pela migração da assinatura
-- auditável) — "uid()" citado no CLAUDE.md é só um helper client-side (App.jsx),
-- não existe como função no Postgres.
create extension if not exists pgcrypto with schema extensions;

create table if not exists atendimento_intervencoes (
  id                text primary key default gen_random_uuid()::text,
  -- atendimentos.id é uuid (igual rvts.id) — diferente de paineis/clientes/dispositivos,
  -- que usam o padrão de id curto em text.
  atendimento_id    uuid not null references atendimentos(id) on delete cascade,
  cliente_id        text,        -- denormalizado (mesmo padrão de atendimentos) p/ RLS direto
  rvt_id            uuid references rvts(id) on delete set null,
  data              date not null default current_date,
  tecnico           text,
  status_resultante text not null check (status_resultante in ('andamento', 'resolvido')),
  descricao         text not null,
  fotos             jsonb not null default '[]'::jsonb,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_atendimento_intervencoes_atendimento_id on atendimento_intervencoes (atendimento_id);
create index if not exists idx_atendimento_intervencoes_rvt_id         on atendimento_intervencoes (rvt_id);
create index if not exists idx_atendimento_intervencoes_cliente_id     on atendimento_intervencoes (cliente_id);

alter table atendimento_intervencoes enable row level security;

drop policy if exists "atendimento_intervencoes_select" on atendimento_intervencoes;
create policy "atendimento_intervencoes_select" on atendimento_intervencoes
  for select using ( is_admin() or has_client_access(cliente_id) );

drop policy if exists "atendimento_intervencoes_insert" on atendimento_intervencoes;
create policy "atendimento_intervencoes_insert" on atendimento_intervencoes
  for insert with check ( is_admin() or has_client_access(cliente_id) );

alter table rvt_itens add column if not exists intervencao_id text references atendimento_intervencoes(id) on delete cascade;
create index if not exists idx_rvt_itens_intervencao_id on rvt_itens (intervencao_id);

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select 'tabela atendimento_intervencoes' as check, count(*) as existe
  from information_schema.tables where table_name = 'atendimento_intervencoes'
union all
select 'rvt_itens.intervencao_id', count(*)
  from information_schema.columns
 where table_name = 'rvt_itens' and column_name = 'intervencao_id';
