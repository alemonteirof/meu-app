-- ============================================================================
--  Migração — Reverter status ao excluir o RVT que resolveu o item
--  Rodar UMA vez no SQL Editor do Supabase. Sem BOM.
--
--  Problema: se o RVT que registrou a intervenção que fechou uma corretiva
--  (status = Resolvido) for excluído, a intervenção ficava órfã (rvt_id vira
--  null) mas continuava valendo — o item nunca "voltava" a Aguardando/Andamento.
--
--  Faz: atendimento_intervencoes.rvt_id passa de "on delete set null" pra
--  "on delete cascade" — excluir o RVT remove a(s) intervenção(ões) registrada(s)
--  nele (junto com o item de visita correspondente, via intervencao_id que já é
--  cascade). O recálculo do status do atendimento pro que restar (ou volta pra
--  "aguardando" se não sobrar nenhuma intervenção) é feito no app, em deleteVisita.
--
--  Tudo aditivo/substitutivo de constraint — nenhuma linha existente é apagada
--  por rodar esta migração.
-- ============================================================================

alter table atendimento_intervencoes drop constraint if exists atendimento_intervencoes_rvt_id_fkey;
alter table atendimento_intervencoes add constraint atendimento_intervencoes_rvt_id_fkey
  foreign key (rvt_id) references rvts(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Verificação pós-migração (delete_rule deve ser CASCADE)
-- ---------------------------------------------------------------------------
select tc.constraint_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
 where tc.table_name = 'atendimento_intervencoes' and tc.constraint_type = 'FOREIGN KEY';
