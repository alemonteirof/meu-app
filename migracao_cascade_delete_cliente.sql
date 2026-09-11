-- Excluir cliente falhava com erro 409 (23503 - foreign key violation), ex:
-- "update or delete on table clientes violates foreign key constraint
--  dispositivos_cliente_id_fkey on table dispositivos"
-- O app só loga o erro no console (não mostra nada pro usuário), então o
-- cliente parecia "não excluir" e reaparecia ao recarregar a lista.
--
-- Esta migração adiciona ON DELETE CASCADE em toda foreign key que aponta
-- pra clientes.id, sem precisar listar tabela por tabela (cobre paineis,
-- dispositivos, atendimentos, rvts, combate_*, etc. e qualquer tabela nova
-- que venha a referenciar clientes.id no futuro).
do $$
declare
  r record;
begin
  for r in
    select
      c.conname,
      cl.relname as table_name,
      (select attname from pg_attribute
       where attrelid = c.conrelid and attnum = c.conkey[1]) as local_column
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_class refcl on refcl.oid = c.confrelid
    where c.contype = 'f'
      and refcl.relname = 'clientes'
      and c.confdeltype <> 'c'
  loop
    execute format('alter table %I drop constraint %I', r.table_name, r.conname);
    execute format(
      'alter table %I add constraint %I foreign key (%I) references clientes(id) on delete cascade',
      r.table_name, r.conname, r.local_column
    );
    raise notice 'cascade aplicado: %.% -> clientes.id', r.table_name, r.local_column;
  end loop;
end $$;
