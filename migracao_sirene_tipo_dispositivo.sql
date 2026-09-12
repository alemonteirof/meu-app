-- ===========================================================================
-- Migração — Sirene como dispositivo (filho de módulo de saída ou de NAC)
-- ===========================================================================
-- Sirene passa a ser um tipo de dispositivo próprio (tipo_modulo = 'sirene'),
-- sempre vinculado via modulo_pai_id (coluna já criada na migração anterior,
-- migracao_dispositivo_complementar_pai.sql) a um módulo de saída OU a uma NAC
-- (NAC já é uma linha de `dispositivos` com laco_id null e painel_id setado).
--
-- Só adiciona 'sirene' ao CHECK de tipo_modulo, se ele existir. Nada é apagado.
-- Rode no SQL editor do Supabase. É idempotente.
-- ===========================================================================

do $$
declare
  v_conname text;
begin
  select con.conname
    into v_conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
   where rel.relname = 'dispositivos'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%tipo_modulo%'
   limit 1;

  if v_conname is not null then
    execute format('alter table dispositivos drop constraint %I', v_conname);
    execute format($f$
      alter table dispositivos add constraint %I check (
        tipo_modulo in (
          'fumaca','calor','acionador','saida','rele','entrada','entrada_duplo',
          'zona','modulo_saida','detector_gas','outro',
          'rede_conversor','rede_placa','sirene'
        )
      )
    $f$, v_conname);
    raise notice 'CHECK % recriado incluindo sirene', v_conname;
  else
    raise notice 'Nenhum CHECK em tipo_modulo — nada a fazer';
  end if;
end $$;
