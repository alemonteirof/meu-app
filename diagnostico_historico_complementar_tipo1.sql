-- ===========================================================================
-- Diagnóstico (só leitura) — quanto histórico ainda aponta pro MÓDULO (pai)
-- em vez do SENSOR (filho) criado no backfill de Dispositivo Complementar
-- Tipo 1 (Beam/Chama/Gás/Termovelocimétrico).
-- Não altera nada. Rode no SQL Editor do Supabase.
-- ===========================================================================

-- PASSO 1 — quantos atendimentos/inspeções ainda referenciam o módulo pai
-- (que hoje não tem mais categoria_funcional — ela migrou pro filho)
select
  'atendimentos' as tabela, count(*) as qtd
from atendimentos a
join dispositivos pai on pai.id = a.dispositivo_id
where exists (select 1 from dispositivos f where f.modulo_pai_id = pai.id)
union all
select
  'inspecoes' as tabela, count(*) as qtd
from inspecoes i
join dispositivos pai on pai.id = i.dispositivo_id
where exists (select 1 from dispositivos f where f.modulo_pai_id = pai.id)
union all
select
  'combate_componentes' as tabela, count(*) as qtd
from combate_componentes cc
join dispositivos pai on pai.id = cc.dispositivo_id
where exists (select 1 from dispositivos f where f.modulo_pai_id = pai.id);

-- PASSO 2 — detalhe por dispositivo (pai x quantos atendimentos/inspeções presos nele,
-- pra você ver que módulo/cliente tem mais coisa pra corrigir)
select
  pai.cliente_id, pai.endereco, pai.id as modulo_id, f.id as sensor_id, f.categoria_funcional,
  (select count(*) from atendimentos a where a.dispositivo_id = pai.id) as atendimentos_presos,
  (select count(*) from inspecoes i where i.dispositivo_id = pai.id) as inspecoes_presas
from dispositivos pai
join dispositivos f on f.modulo_pai_id = pai.id
order by pai.cliente_id, pai.endereco;
