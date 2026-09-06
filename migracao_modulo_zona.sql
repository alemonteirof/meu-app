-- ===========================================================================
-- Migração — Módulo de Zona (CZM / FZM-1)
-- ===========================================================================
-- Contexto: os modelos CZM (Hochiki) e FZM-1 (Notifier) eram importados como
-- "Módulo de Entrada" (tipo_modulo = 'entrada'). Eles são, na verdade, MÓDULOS
-- DE ZONA — supervisionam uma zona de detecção convencional inteira, não um
-- ponto endereçável único.
--
-- Esta migração:
--   1. (se houver CHECK em dispositivos.tipo_modulo) recria o CHECK incluindo 'zona'
--   2. reclassifica os dispositivos CZM / FZM-1 de 'entrada' -> 'zona'
--   3. limpa a categoria_funcional antiga desses registros (as categorias de
--      zona são outras: zona_calor / zona_fumaca / zona_chama / zona_geral /
--      zona_outro) e o papel_sinal (não se aplica a módulo de zona)
--
-- Padrão seguro: só UPDATE. Nada é apagado.
-- Rode no SQL editor do Supabase. É idempotente (pode rodar de novo sem efeito).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 — CHECK constraint em tipo_modulo (só age se existir um)
-- ---------------------------------------------------------------------------
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
          'rede_conversor','rede_placa'
        )
      )
    $f$, v_conname);
    raise notice 'CHECK % recriado incluindo zona', v_conname;
  else
    raise notice 'Nenhum CHECK em tipo_modulo — nada a fazer no passo 1';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PASSO 2 — pré-visualização: o que vai ser reclassificado
-- ---------------------------------------------------------------------------
select id, endereco, etiqueta, modelo, tipo_modulo, categoria_funcional, papel_sinal
  from dispositivos
 where tipo_modulo in ('entrada', 'entrada_duplo')
   and (modelo ilike 'CZM' or modelo ilike 'FZM-1' or modelo ilike 'FZM%')
 order by modelo, endereco;

-- ---------------------------------------------------------------------------
-- PASSO 3 — reclassifica CZM / FZM-1 para 'zona'
-- ---------------------------------------------------------------------------
update dispositivos
   set tipo_modulo        = 'zona',
       categoria_funcional = null,
       papel_sinal         = null,
       sub_endereco        = null
 where tipo_modulo in ('entrada', 'entrada_duplo')
   and (modelo ilike 'CZM' or modelo ilike 'FZM-1' or modelo ilike 'FZM%');

-- ---------------------------------------------------------------------------
-- Verificação pós-migração
-- ---------------------------------------------------------------------------
select tipo_modulo, count(*) as qtd
  from dispositivos
 where tipo_modulo = 'zona'
 group by tipo_modulo;
