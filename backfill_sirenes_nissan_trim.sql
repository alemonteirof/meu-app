-- ===========================================================================
-- Backfill — Recupera sirenes perdidas (Nissan / painel TRIM)
-- ===========================================================================
-- As sirenes abaixo tinham sido cadastradas nos módulos de saída (categoria
-- funcional "Sirenes"), mas o upsert de `dispositivos` estava falhando porque
-- a sirene não tinha `endereco` (coluna NOT NULL, sem default) — corrigido em
-- App.jsx (syncSirenes agora herda o endereço do módulo pai) e no
-- supabaseAdapter.js (nunca manda `null` explícito nessa coluna). Este script
-- recadastra direto no banco as sirenes que nunca chegaram a ser gravadas,
-- herdando o mesmo endereço do módulo-pai (mesmo comportamento do app).
--
-- Modelo: 'bullet' (Bullet Genérica, marca Hochiki). Localização = endereço
-- físico informado (bullet), vira `etiqueta`. Sem endereço de laço próprio —
-- herda o do módulo pai só pra satisfazer o NOT NULL, vínculo real é via
-- modulo_pai_id.
--
-- Rode no SQL editor do Supabase. Idempotente? NÃO — rode só 1x (reinserir
-- duplica). Primeiro roda o SELECT de verificação; só roda o INSERT se a
-- verificação não retornar nenhuma linha (todos os módulos-pai encontrados).
-- ===========================================================================

with alvo(endereco, laco_numero, localizacao) as (
  values
    ('085.01', 1, 'B7'), ('085.01', 1, 'D5'), ('085.01', 1, 'F5'), ('085.01', 1, 'F6'),
    ('085.01', 1, 'E7'), ('085.01', 1, 'J7'), ('085.01', 1, 'L7'), ('085.01', 1, 'J5'),

    ('086.01', 1, 'H4'),

    ('087.01', 1, 'E2'),

    ('010.01', 1, 'B11'), ('010.01', 1, 'H14'), ('010.01', 1, 'K13'), ('010.01', 1, 'D13'),
    ('010.01', 1, 'Próxima a D13'),

    ('017.01', 1, 'E16'), ('017.01', 1, 'F15'), ('017.01', 1, 'B15'), ('017.01', 1, 'E11'),
    ('017.01', 1, 'F12'), ('017.01', 1, 'J12'), ('017.01', 1, 'L11'),

    ('035.01', 1, 'D9'), ('035.01', 1, 'A9'), ('035.01', 1, 'A13'), ('035.01', 1, 'A16/17'),
    ('035.01', 1, 'B17'), ('035.01', 1, 'E17'),

    ('036.01', 1, 'L10'), ('036.01', 1, 'N9'), ('036.01', 1, 'P10'), ('036.01', 1, 'P11'),
    ('036.01', 1, 'S11'), ('036.01', 1, 'V11'), ('036.01', 1, 'R9'), ('036.01', 1, 'L8'),

    ('046.01', 1, 'K15'), ('046.01', 1, 'M15'), ('046.01', 1, 'P15'), ('046.01', 1, 'N13'),
    ('046.01', 1, 'R13'), ('046.01', 1, 'R15'), ('046.01', 1, 'T 14/15'), ('046.01', 1, 'U13'),

    ('033.01', 2, 'S7'), ('033.01', 2, 'V7'), ('033.01', 2, 'P7'), ('033.01', 2, 'N6'),
    ('033.01', 2, 'P8'), ('033.01', 2, 'L6')
),
pai as (
  select t.endereco, t.laco_numero, t.localizacao,
         d.id as pai_id, d.laco_id, d.cliente_id, d.endereco as pai_endereco
  from alvo t
  join lacos l on l.numero = t.laco_numero
  join paineis p on p.id = l.painel_id
  join clientes c on c.id = p.cliente_id
  join dispositivos d on d.laco_id = l.id and d.endereco = t.endereco
  where c.nome ilike '%nissan%' and p.nome ilike '%trim%'
)
-- 1) VERIFICAÇÃO — rode isto primeiro. Se retornar QUALQUER linha, algum
--    módulo-pai não foi encontrado (endereço/laço/painel/cliente não bate) —
--    não rode o INSERT antes de resolver isso.
select t.endereco, t.laco_numero, t.localizacao
from alvo t
left join pai on pai.endereco = t.endereco and pai.laco_numero = t.laco_numero
where pai.pai_id is null;

-- 2) INSERT — só rode isto (statement separado, com os mesmos CTEs) depois de
--    confirmar que a verificação acima veio vazia.
--
-- with alvo(endereco, laco_numero, localizacao) as (
--   values
--     ('085.01', 1, 'B7'), ('085.01', 1, 'D5'), ('085.01', 1, 'F5'), ('085.01', 1, 'F6'),
--     ('085.01', 1, 'E7'), ('085.01', 1, 'J7'), ('085.01', 1, 'L7'), ('085.01', 1, 'J5'),
--     ('086.01', 1, 'H4'),
--     ('087.01', 1, 'E2'),
--     ('010.01', 1, 'B11'), ('010.01', 1, 'H14'), ('010.01', 1, 'K13'), ('010.01', 1, 'D13'),
--     ('010.01', 1, 'Próxima a D13'),
--     ('017.01', 1, 'E16'), ('017.01', 1, 'F15'), ('017.01', 1, 'B15'), ('017.01', 1, 'E11'),
--     ('017.01', 1, 'F12'), ('017.01', 1, 'J12'), ('017.01', 1, 'L11'),
--     ('035.01', 1, 'D9'), ('035.01', 1, 'A9'), ('035.01', 1, 'A13'), ('035.01', 1, 'A16/17'),
--     ('035.01', 1, 'B17'), ('035.01', 1, 'E17'),
--     ('036.01', 1, 'L10'), ('036.01', 1, 'N9'), ('036.01', 1, 'P10'), ('036.01', 1, 'P11'),
--     ('036.01', 1, 'S11'), ('036.01', 1, 'V11'), ('036.01', 1, 'R9'), ('036.01', 1, 'L8'),
--     ('046.01', 1, 'K15'), ('046.01', 1, 'M15'), ('046.01', 1, 'P15'), ('046.01', 1, 'N13'),
--     ('046.01', 1, 'R13'), ('046.01', 1, 'R15'), ('046.01', 1, 'T 14/15'), ('046.01', 1, 'U13'),
--     ('033.01', 2, 'S7'), ('033.01', 2, 'V7'), ('033.01', 2, 'P7'), ('033.01', 2, 'N6'),
--     ('033.01', 2, 'P8'), ('033.01', 2, 'L6')
-- ),
-- pai as (
--   select t.endereco, t.laco_numero, t.localizacao,
--          d.id as pai_id, d.laco_id, d.cliente_id, d.endereco as pai_endereco
--   from alvo t
--   join lacos l on l.numero = t.laco_numero
--   join paineis p on p.id = l.painel_id
--   join clientes c on c.id = p.cliente_id
--   join dispositivos d on d.laco_id = l.id and d.endereco = t.endereco
--   where c.nome ilike '%nissan%' and p.nome ilike '%trim%'
-- )
-- insert into dispositivos
--   (id, cliente_id, laco_id, painel_id, endereco, etiqueta, tipo_modulo, modelo, categoria_funcional, modulo_pai_id)
-- select
--   substr(md5(random()::text || clock_timestamp()::text), 1, 12),
--   pai.cliente_id, pai.laco_id, null, pai.pai_endereco, pai.localizacao, 'sirene', 'bullet', 'sirenes', pai.pai_id
-- from pai;
