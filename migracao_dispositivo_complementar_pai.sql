-- Sensor complementar Tipo 1 (Beam/Chama/Gás/Termovelocimétrico) vira registro próprio,
-- vinculado ao módulo de entrada via modulo_pai_id, em vez de reaproveitar a mesma linha.
alter table dispositivos add column if not exists modulo_pai_id text references dispositivos(id) on delete set null;
create index if not exists idx_dispositivos_modulo_pai_id on dispositivos (modulo_pai_id);
