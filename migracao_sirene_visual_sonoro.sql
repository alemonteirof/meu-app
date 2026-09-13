-- ===========================================================================
-- Migração — Critérios "Visual" e "Sonoro" na inspeção/dispositivo de Sirene
-- ===========================================================================
-- Sirene (tipo_modulo = 'sirene') ganha 2 critérios de avaliação além dos 4 já
-- existentes (Funcionamento/Aparência/Com. local/Com. rede): Visual e Sonoro.
-- Mesmo vocabulário de resultado_teste (Aprovado/Reprovado/Não avaliado) — NÃO
-- o de aparência (Ótimo/Bom/Regular/Precisa Trocar).
--
-- Aditivo, idempotente. Rode no SQL Editor do Supabase antes de subir o build
-- que depende destas colunas.
-- ===========================================================================

alter table inspecoes  add column if not exists visual text;
alter table inspecoes  add column if not exists sonoro text;
alter table dispositivos add column if not exists visual text;
alter table dispositivos add column if not exists sonoro text;

alter table inspecoes drop constraint if exists inspecoes_visual_check;
alter table inspecoes add constraint inspecoes_visual_check
  check (visual is null or visual in ('Aprovado','Reprovado','Não avaliado'));

alter table inspecoes drop constraint if exists inspecoes_sonoro_check;
alter table inspecoes add constraint inspecoes_sonoro_check
  check (sonoro is null or sonoro in ('Aprovado','Reprovado','Não avaliado'));

alter table dispositivos drop constraint if exists dispositivos_visual_check;
alter table dispositivos add constraint dispositivos_visual_check
  check (visual is null or visual in ('Aprovado','Reprovado','Não avaliado'));

alter table dispositivos drop constraint if exists dispositivos_sonoro_check;
alter table dispositivos add constraint dispositivos_sonoro_check
  check (sonoro is null or sonoro in ('Aprovado','Reprovado','Não avaliado'));

-- Verificação pós-migração
select column_name, data_type
  from information_schema.columns
 where table_name in ('inspecoes','dispositivos')
   and column_name in ('visual','sonoro')
 order by table_name, column_name;
