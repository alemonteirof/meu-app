-- =====================================================================
-- Supervisório FireNET (painel ao vivo, eventos, comandos, planta baixa)
-- APLICADA em 16/10/2026 no projeto MAJ SDAI (migração "supervisorio_firenet").
--
-- Fluxo: Raspberry Pi (gateway) ligado no painel principal do cliente
--   -> lê tela (F9) e LEDs (F7) -> manda só as mudanças para uma Edge Function
--   (supervisorio-ingest, a criar) que grava aqui com a service role.
-- O gateway NUNCA recebe a chave service_role: ele se identifica com um token
-- próprio, guardado aqui só como hash (supervisorio_gateways.token_hash).
-- Acesso das telas: mesma regra do resto do CCM, has_client_access(cliente_id).
-- =====================================================================

-- 1) Gateways instalados nos clientes
create table if not exists public.supervisorio_gateways (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     text not null references public.clientes(id) on delete cascade,
  painel_id      text references public.paineis(id) on delete set null,  -- painel principal onde está ligado
  nome           text not null,                                          -- ex.: "NISSAN - SECURITY OFFICE"
  token_hash     text not null,                                          -- sha256 do token do gateway
  modo           text not null default 'leitura' check (modo in ('leitura', 'leitura_comandos')),
  versao         text,
  ultimo_contato timestamptz,
  created_at     timestamptz not null default now()
);

-- 2) Estado ao vivo (1 linha por painel; o gateway faz upsert)
create table if not exists public.supervisorio_estado (
  painel_id      text primary key references public.paineis(id) on delete cascade,
  cliente_id     text not null references public.clientes(id) on delete cascade,
  gateway_id     uuid references public.supervisorio_gateways(id) on delete set null,
  online         boolean not null default false,
  alarmes        integer,
  falhas         integer,
  desativacoes   integer,
  silenciado     boolean,
  acesso2        boolean,
  leds           text,          -- 5 bytes em hexa, ex.: "28 00 40 00 05"
  tela           text[],        -- linhas do visor do painel
  atualizado_em  timestamptz not null default now()
);

-- 3) Eventos (append-only: base do histórico)
create table if not exists public.supervisorio_eventos (
  id             bigint generated always as identity primary key,
  cliente_id     text not null references public.clientes(id) on delete cascade,
  painel_id      text references public.paineis(id) on delete set null,
  gateway_id     uuid references public.supervisorio_gateways(id) on delete set null,
  dispositivo_id text references public.dispositivos(id) on delete set null,
  data_hora      timestamptz not null,
  tipo           text not null,   -- FOGO, FALHA, DESATIVACAO, SILENCIADO, COMANDO, ONLINE, OFFLINE...
  texto          text not null,
  detalhe        text,
  origem         text not null default 'painel' check (origem in ('painel', 'gateway', 'ccm')),
  operador_id    uuid references auth.users(id) on delete set null,  -- preenchido em comandos do CCM
  created_at     timestamptz not null default now()
);
create index if not exists supervisorio_eventos_cliente_data
  on public.supervisorio_eventos (cliente_id, data_hora desc);

-- 4) Comandos pedidos pelo CCM (FASE 2 — o gateway começa só lendo)
-- A senha de nível 2 do painel NÃO é gravada aqui: segue direto para o gateway
-- por canal Realtime e é descartada depois de digitada no painel.
create table if not exists public.supervisorio_comandos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     text not null references public.clientes(id) on delete cascade,
  painel_id      text not null references public.paineis(id) on delete cascade,
  tecla          text not null check (tecla in ('S', 'A', 'B', 'L', 'R', 'X')),  -- silenciar, re-sound, buzzer, lâmpadas, reset, função
  status         text not null default 'pendente'
                   check (status in ('pendente', 'enviado', 'confirmado', 'falhou', 'expirado')),
  solicitado_por uuid not null references auth.users(id),
  verificado_por text,            -- quem verificou o local antes do reset
  resposta       text,
  criado_em      timestamptz not null default now(),
  executado_em   timestamptz
);

-- 5) Planta baixa: imagens (no Storage) e posição de cada dispositivo
create table if not exists public.supervisorio_plantas (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   text not null references public.clientes(id) on delete cascade,
  painel_id    text references public.paineis(id) on delete set null,
  nome         text not null,     -- ex.: "SECURITY OFFICE - Térreo"
  imagem_path  text not null,     -- caminho no bucket de Storage
  largura      integer,
  altura       integer,
  ordem        integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.supervisorio_posicoes (
  planta_id      uuid not null references public.supervisorio_plantas(id) on delete cascade,
  dispositivo_id text not null references public.dispositivos(id) on delete cascade,
  cliente_id     text not null references public.clientes(id) on delete cascade,
  x_pct          numeric(6,3) not null check (x_pct between 0 and 100),  -- posição em % da imagem
  y_pct          numeric(6,3) not null check (y_pct between 0 and 100),
  primary key (planta_id, dispositivo_id)
);

-- ---------------------------------------------------------------------
-- RLS: telas leem pelo has_client_access; estado/eventos só a Edge Function escreve
-- ---------------------------------------------------------------------
alter table public.supervisorio_gateways enable row level security;
alter table public.supervisorio_estado   enable row level security;
alter table public.supervisorio_eventos  enable row level security;
alter table public.supervisorio_comandos enable row level security;
alter table public.supervisorio_plantas  enable row level security;
alter table public.supervisorio_posicoes enable row level security;

create policy supervisorio_gateways_leitura on public.supervisorio_gateways
  for select using (has_client_access(cliente_id));
create policy supervisorio_estado_leitura on public.supervisorio_estado
  for select using (has_client_access(cliente_id));
create policy supervisorio_eventos_leitura on public.supervisorio_eventos
  for select using (has_client_access(cliente_id));

create policy supervisorio_comandos_leitura on public.supervisorio_comandos
  for select using (has_client_access(cliente_id));
create policy supervisorio_comandos_pedido on public.supervisorio_comandos
  for insert with check (has_client_access(cliente_id) and solicitado_por = auth.uid());

create policy supervisorio_plantas_acesso on public.supervisorio_plantas
  for all using (has_client_access(cliente_id)) with check (has_client_access(cliente_id));
create policy supervisorio_posicoes_acesso on public.supervisorio_posicoes
  for all using (has_client_access(cliente_id)) with check (has_client_access(cliente_id));

-- Tempo real: as telas recebem estado e eventos novos sem recarregar
alter publication supabase_realtime add table public.supervisorio_estado;
alter publication supabase_realtime add table public.supervisorio_eventos;
