-- ===========================================================================
-- Reaponta histórico preso no módulo (pai) pro sensor (filho) criado no
-- backfill de Dispositivo Complementar Tipo 1. Só afeta linhas cujo
-- dispositivo_id hoje é um módulo que já tem filho (o sensor certo).
-- ===========================================================================

-- PASSO 1 — pré-visualização: o que vai ser reapontado
select 'atendimentos' as tabela, a.id, a.dispositivo_id as id_atual_modulo, f.id as vai_virar_sensor, f.categoria_funcional
  from atendimentos a
  join dispositivos f on f.modulo_pai_id = a.dispositivo_id
union all
select 'inspecoes' as tabela, i.id, i.dispositivo_id, f.id, f.categoria_funcional
  from inspecoes i
  join dispositivos f on f.modulo_pai_id = i.dispositivo_id
union all
select 'combate_componentes' as tabela, cc.id, cc.dispositivo_id, f.id, f.categoria_funcional
  from combate_componentes cc
  join dispositivos f on f.modulo_pai_id = cc.dispositivo_id;

-- PASSO 2 — aplica
update atendimentos a
   set dispositivo_id = f.id
  from dispositivos f
 where f.modulo_pai_id = a.dispositivo_id;

update inspecoes i
   set dispositivo_id = f.id
  from dispositivos f
 where f.modulo_pai_id = i.dispositivo_id;

update combate_componentes cc
   set dispositivo_id = f.id
  from dispositivos f
 where f.modulo_pai_id = cc.dispositivo_id;

-- PASSO 3 — verificação: deve voltar 0 linhas (nada mais preso no módulo)
select 'atendimentos' as tabela, count(*) as ainda_presos
  from atendimentos a
  join dispositivos f on f.modulo_pai_id = a.dispositivo_id
union all
select 'inspecoes', count(*)
  from inspecoes i
  join dispositivos f on f.modulo_pai_id = i.dispositivo_id
union all
select 'combate_componentes', count(*)
  from combate_componentes cc
  join dispositivos f on f.modulo_pai_id = cc.dispositivo_id;
