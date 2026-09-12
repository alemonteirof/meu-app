-- ===========================================================================
-- Backfill — divide dispositivos JÁ classificados (Tipo 1: Beam/Chama/Gás/
-- Termovelocimétrico) que ainda estão no modelo antigo (1 linha só) em
-- pai (módulo, sem categoria) + filho (sensor, vinculado via modulo_pai_id).
--
-- Necessário rodar DEPOIS de migracao_dispositivo_complementar_pai.sql.
-- Idempotente: só afeta módulos que ainda não têm filho (pode rodar de novo
-- sem duplicar). Nada é apagado — o pai só tem os campos do sensor zerados
-- (eles passam a viver só no filho).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 — pré-visualização: o que vai ser dividido
-- ---------------------------------------------------------------------------
select id, endereco, etiqueta, tipo_modulo, categoria_funcional, papel_sinal, etiqueta_complementar
  from dispositivos d
 where d.tipo_modulo in ('entrada', 'entrada_duplo')
   and d.categoria_funcional in ('detector_linear', 'detector_chama', 'detector_gas_hc', 'detector_gas_co2', 'detector_gas_outro', 'termovelocimetrico')
   and not exists (select 1 from dispositivos c where c.modulo_pai_id = d.id)
 order by endereco;

-- ---------------------------------------------------------------------------
-- PASSO 2 — cria o filho (sensor), copiando categoria/papel/etiqueta/calibração
-- e o snapshot de inspeção (resultado do teste, aparência, comunicação) que
-- hoje mora na mesma linha do módulo.
-- ---------------------------------------------------------------------------
insert into dispositivos (
  id, cliente_id, laco_id, painel_id, endereco, tipo_modulo,
  categoria_funcional, papel_sinal, sub_endereco,
  etiqueta_complementar, data_calibracao, proxima_calibracao,
  proxima_inspecao, ultima_manutencao, ultima_inspecao,
  resultado_teste, aparencia, comunicacao_local, comunicacao_rede,
  modulo_pai_id
)
select
  gen_random_uuid()::text, d.cliente_id, d.laco_id, null, d.endereco, d.tipo_modulo,
  d.categoria_funcional, d.papel_sinal, d.sub_endereco,
  d.etiqueta_complementar, d.data_calibracao, d.proxima_calibracao,
  d.proxima_inspecao, d.ultima_manutencao, d.ultima_inspecao,
  d.resultado_teste, d.aparencia, d.comunicacao_local, d.comunicacao_rede,
  d.id
from dispositivos d
where d.tipo_modulo in ('entrada', 'entrada_duplo')
  and d.categoria_funcional in ('detector_linear', 'detector_chama', 'detector_gas_hc', 'detector_gas_co2', 'detector_gas_outro', 'termovelocimetrico')
  and not exists (select 1 from dispositivos c where c.modulo_pai_id = d.id);

-- ---------------------------------------------------------------------------
-- PASSO 3 — limpa o pai (módulo): os campos do sensor agora vivem só no filho.
-- ---------------------------------------------------------------------------
update dispositivos d
   set categoria_funcional = null, papel_sinal = null,
       etiqueta_complementar = null, data_calibracao = null, proxima_calibracao = null,
       proxima_inspecao = null, ultima_manutencao = null, ultima_inspecao = null,
       resultado_teste = null, aparencia = null, comunicacao_local = null, comunicacao_rede = null
 where d.tipo_modulo in ('entrada', 'entrada_duplo')
   and exists (select 1 from dispositivos c where c.modulo_pai_id = d.id and c.categoria_funcional is not null);

-- ---------------------------------------------------------------------------
-- Verificação pós-backfill
-- ---------------------------------------------------------------------------
select
  pai.id as modulo_id, pai.endereco, pai.categoria_funcional as categoria_no_pai,
  filho.id as sensor_id, filho.categoria_funcional as categoria_no_filho, filho.etiqueta_complementar
from dispositivos pai
join dispositivos filho on filho.modulo_pai_id = pai.id
order by pai.endereco;
