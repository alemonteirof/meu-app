-- ============================================================================
--  Migração — Visualizador (cliente) passa a ser SOMENTE LEITURA no banco
--  Revisão de segurança 06/11/2026 (skill security-audit, modo guia). Sem BOM.
--
--  Problema: has_client_access() só olha se existe vínculo com o cliente, não o
--  papel. As policies FOR ALL das tabelas principais deixavam qualquer vínculo,
--  inclusive 'visualizador', gravar/apagar dados do próprio cliente direto pela
--  API (o app só escondia os botões). Ex.: trocar resultado de inspeção, apagar
--  RVT assinado — e a trilha assinatura_auditoria ia junto (FK ON DELETE CASCADE).
--
--  Faz (mesmo padrão já usado em pendencias / nao_conformidades):
--   1. Cada policy FOR ALL vira: SELECT = has_client_access;
--      INSERT/UPDATE/DELETE = is_maj_staff() AND has_client_access.
--   2. atendimento_intervencoes (insert), supervisorio_comandos (insert) e
--      Storage `fotos` (upload) passam a exigir is_maj_staff().
--   3. Assinatura do CLIENTE no RVT (única escrita legítima do visualizador)
--      vai por RPC assinar_rvt_cliente() — só mexe nas colunas da assinatura.
--      O trigger log_assinatura_rvt continua carimbando uid/e-mail/data.
--   4. assinatura_auditoria perde a FK com cascade (trilha sobrevive à exclusão
--      do RVT, igual à trilha MAJ) e a exclusão de RVT assinado vira evento.
--   5. search_path fixo em handle_new_user / bloqueia_assinatura_tecnico_insert.
--
--  NÃO muda: leitura de ninguém, kv_store, memberships, profiles, tabelas MAJ.
--  Subir o build novo (supabaseAdapter usando a RPC) JUNTO com esta migração —
--  o build antigo faz UPDATE direto em rvts e a assinatura do cliente falharia.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PASSO 1 — tabelas com cliente_id próprio
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('atendimentos',               'atendimentos_acesso'),
      ('baterias_painel',            'baterias_painel_access'),
      ('combate_agua_itens',         'combate_agua_itens_access'),
      ('combate_baterias_cilindros', 'combate_baterias_cilindros_access'),
      ('combate_cilindros',          'combate_cilindros_access'),
      ('combate_componentes',        'combate_componentes_access'),
      ('combate_conjuntos',          'combate_conjuntos_access'),
      ('combate_historico',          'combate_historico_access'),
      ('combate_subitens',           'combate_subitens_access'),
      ('dispositivos',               'dispositivos_acesso'),
      ('fontes_auxiliares',          'fontes_auxiliares_access'),
      ('inspecoes',                  'inspecoes_acesso'),
      ('paineis',                    'paineis_acesso'),
      ('rvts',                       'rvts_acesso'),
      ('supervisorio_plantas',       'supervisorio_plantas_acesso'),
      ('supervisorio_posicoes',      'supervisorio_posicoes_acesso')
    ) as v(tabela, antiga)
  loop
    execute format('drop policy if exists %I on public.%I', t.antiga, t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_select', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_insert', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_update', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_delete', t.tabela);

    execute format('create policy %I on public.%I for select to authenticated using (has_client_access(cliente_id))',
                   t.tabela || '_select', t.tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check (is_maj_staff() and has_client_access(cliente_id))',
                   t.tabela || '_insert', t.tabela);
    execute format('create policy %I on public.%I for update to authenticated using (is_maj_staff() and has_client_access(cliente_id)) with check (is_maj_staff() and has_client_access(cliente_id))',
                   t.tabela || '_update', t.tabela);
    execute format('create policy %I on public.%I for delete to authenticated using (is_maj_staff() and has_client_access(cliente_id))',
                   t.tabela || '_delete', t.tabela);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PASSO 2 — clientes (chave = id) e tabelas que herdam do pai
-- ---------------------------------------------------------------------------
drop policy if exists clientes_acesso on public.clientes;
drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists clientes_delete on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (has_client_access(id));
create policy clientes_insert on public.clientes for insert to authenticated with check (is_maj_staff() and has_client_access(id));
create policy clientes_update on public.clientes for update to authenticated
  using (is_maj_staff() and has_client_access(id)) with check (is_maj_staff() and has_client_access(id));
create policy clientes_delete on public.clientes for delete to authenticated using (is_maj_staff() and has_client_access(id));

-- lacos -> paineis
drop policy if exists lacos_acesso on public.lacos;
drop policy if exists lacos_select on public.lacos;
drop policy if exists lacos_insert on public.lacos;
drop policy if exists lacos_update on public.lacos;
drop policy if exists lacos_delete on public.lacos;
create policy lacos_select on public.lacos for select to authenticated
  using (exists (select 1 from public.paineis p where p.id = lacos.painel_id and has_client_access(p.cliente_id)));
create policy lacos_insert on public.lacos for insert to authenticated
  with check (is_maj_staff() and exists (select 1 from public.paineis p where p.id = lacos.painel_id and has_client_access(p.cliente_id)));
create policy lacos_update on public.lacos for update to authenticated
  using (is_maj_staff() and exists (select 1 from public.paineis p where p.id = lacos.painel_id and has_client_access(p.cliente_id)))
  with check (is_maj_staff() and exists (select 1 from public.paineis p where p.id = lacos.painel_id and has_client_access(p.cliente_id)));
create policy lacos_delete on public.lacos for delete to authenticated
  using (is_maj_staff() and exists (select 1 from public.paineis p where p.id = lacos.painel_id and has_client_access(p.cliente_id)));

-- rvt_itens -> rvts
drop policy if exists rvt_itens_acesso on public.rvt_itens;
drop policy if exists rvt_itens_select on public.rvt_itens;
drop policy if exists rvt_itens_insert on public.rvt_itens;
drop policy if exists rvt_itens_update on public.rvt_itens;
drop policy if exists rvt_itens_delete on public.rvt_itens;
create policy rvt_itens_select on public.rvt_itens for select to authenticated
  using (exists (select 1 from public.rvts r where r.id = rvt_itens.rvt_id and has_client_access(r.cliente_id)));
create policy rvt_itens_insert on public.rvt_itens for insert to authenticated
  with check (is_maj_staff() and exists (select 1 from public.rvts r where r.id = rvt_itens.rvt_id and has_client_access(r.cliente_id)));
create policy rvt_itens_update on public.rvt_itens for update to authenticated
  using (is_maj_staff() and exists (select 1 from public.rvts r where r.id = rvt_itens.rvt_id and has_client_access(r.cliente_id)))
  with check (is_maj_staff() and exists (select 1 from public.rvts r where r.id = rvt_itens.rvt_id and has_client_access(r.cliente_id)));
create policy rvt_itens_delete on public.rvt_itens for delete to authenticated
  using (is_maj_staff() and exists (select 1 from public.rvts r where r.id = rvt_itens.rvt_id and has_client_access(r.cliente_id)));

-- saida_subitens -> dispositivos
drop policy if exists saida_subitens_acesso on public.saida_subitens;
drop policy if exists saida_subitens_select on public.saida_subitens;
drop policy if exists saida_subitens_insert on public.saida_subitens;
drop policy if exists saida_subitens_update on public.saida_subitens;
drop policy if exists saida_subitens_delete on public.saida_subitens;
create policy saida_subitens_select on public.saida_subitens for select to authenticated
  using (exists (select 1 from public.dispositivos d where d.id = saida_subitens.dispositivo_id and has_client_access(d.cliente_id)));
create policy saida_subitens_insert on public.saida_subitens for insert to authenticated
  with check (is_maj_staff() and exists (select 1 from public.dispositivos d where d.id = saida_subitens.dispositivo_id and has_client_access(d.cliente_id)));
create policy saida_subitens_update on public.saida_subitens for update to authenticated
  using (is_maj_staff() and exists (select 1 from public.dispositivos d where d.id = saida_subitens.dispositivo_id and has_client_access(d.cliente_id)))
  with check (is_maj_staff() and exists (select 1 from public.dispositivos d where d.id = saida_subitens.dispositivo_id and has_client_access(d.cliente_id)));
create policy saida_subitens_delete on public.saida_subitens for delete to authenticated
  using (is_maj_staff() and exists (select 1 from public.dispositivos d where d.id = saida_subitens.dispositivo_id and has_client_access(d.cliente_id)));

-- ---------------------------------------------------------------------------
-- PASSO 3 — inserts soltos: intervenções, comandos do supervisório, fotos
-- ---------------------------------------------------------------------------
drop policy if exists atendimento_intervencoes_insert on public.atendimento_intervencoes;
create policy atendimento_intervencoes_insert on public.atendimento_intervencoes for insert
  with check (is_maj_staff() and has_client_access(cliente_id));

-- Comandos (reset/silenciar) no painel: nunca pelo cliente.
drop policy if exists supervisorio_comandos_pedido on public.supervisorio_comandos;
create policy supervisorio_comandos_pedido on public.supervisorio_comandos for insert
  with check (is_maj_staff() and has_client_access(cliente_id) and solicitado_por = auth.uid());

drop policy if exists fotos_insert on storage.objects;
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_maj_staff()
              and public.has_client_access((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- PASSO 4 — RPC: assinatura do cliente no RVT (visualizador ou técnico com o
--           cliente assinando no tablet). Só toca nas colunas da assinatura;
--           o trigger log_assinatura_rvt carimba uid/e-mail/data e audita.
-- ---------------------------------------------------------------------------
create or replace function public.assinar_rvt_cliente(
  p_rvt_id uuid, p_tipo text, p_valor text, p_origem text default null)
returns table (assinatura_cliente_login text, assinatura_cliente_data timestamptz, assinatura_cliente_origem text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Faça login novamente para assinar.'; end if;
  if coalesce(p_valor, '') = '' then raise exception 'Assinatura vazia.'; end if;
  if p_tipo not in ('desenho', 'texto') then raise exception 'Tipo de assinatura inválido: %', p_tipo; end if;
  if coalesce(p_origem, p_tipo) not in ('desenho', 'texto', 'salva') then
    raise exception 'Origem de assinatura inválida: %', p_origem;
  end if;

  select r.cliente_id into v_cliente from public.rvts r where r.id = p_rvt_id;
  if not found or not public.has_client_access(v_cliente) then
    raise exception 'Visita não encontrada ou sem acesso.';
  end if;

  return query
  update public.rvts r
     set assinatura_cliente        = p_valor,
         assinatura_cliente_tipo   = p_tipo,
         assinatura_cliente_origem = coalesce(p_origem, p_tipo)
   where r.id = p_rvt_id
  returning r.assinatura_cliente_login, r.assinatura_cliente_data, r.assinatura_cliente_origem;
end;
$$;
revoke all on function public.assinar_rvt_cliente(uuid, text, text, text) from public, anon;
grant execute on function public.assinar_rvt_cliente(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- PASSO 5 — trilha de assinatura sobrevive à exclusão do RVT
-- ---------------------------------------------------------------------------
alter table public.assinatura_auditoria drop constraint if exists assinatura_auditoria_rvt_id_fkey;

create or replace function public.log_exclusao_rvt_assinado()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if old.assinatura_cliente is not null or old.assinatura_tecnico is not null then
    insert into public.assinatura_auditoria (
      rvt_id, cliente_id, evento, assinado_por_uid, assinado_por_email
    ) values (old.id, old.cliente_id, 'rvt_excluido', auth.uid(), auth.jwt() ->> 'email');
  end if;
  return old;
end;
$$;
revoke all on function public.log_exclusao_rvt_assinado() from public, anon, authenticated;

drop trigger if exists trg_log_exclusao_rvt_assinado on public.rvts;
create trigger trg_log_exclusao_rvt_assinado
  after delete on public.rvts
  for each row
  execute function public.log_exclusao_rvt_assinado();

-- ---------------------------------------------------------------------------
-- PASSO 6 — search_path fixo (aviso do Supabase Advisor)
-- ---------------------------------------------------------------------------
alter function public.handle_new_user() set search_path = public;
alter function public.bloqueia_assinatura_tecnico_insert() set search_path = public;

commit;

-- ---------------------------------------------------------------------------
-- Verificação — policies de escrita sem is_maj_staff/is_admin. Esperado só:
-- assinaturas_salvas (cada um a própria assinatura) e security_events_insert.
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, coalesce(with_check, qual) as regra
  from pg_policies
 where schemaname in ('public', 'storage')
   and cmd <> 'SELECT'
   and coalesce(with_check, qual) not ilike '%is_maj_staff%'
   and coalesce(with_check, qual) not ilike '%is_admin%'
   and coalesce(with_check, qual) not ilike '%role = ''admin''%'
 order by 1, 2;
