-- =====================================================================
-- Fotos no Supabase Storage + ajustes de performance (2026-09-29)
-- =====================================================================
-- Motivo: as fotos de atendimentos / inspeÃ§Ãµes / itens de visita / intervenÃ§Ãµes
-- ficavam em base64 dentro da linha (jsonb). ~54 MB acumulados eram baixados
-- inteiros toda vez que um cliente abria (loadClientData), alÃ©m de a cada
-- recarga depois de salvar. Agora o arquivo vai pro bucket privado `fotos`
-- (<cliente_id>/<uuid>.<ext>) e a linha guarda sÃ³ "storage:<caminho>".
-- A conversÃ£o dos dados antigos Ã© feita pelo app (ConfiguraÃ§Ãµes â†’ Dados),
-- porque o upload pro Storage precisa passar pela API, nÃ£o dÃ¡ via SQL.

-- 1) Backup das colunas com base64 ANTES de qualquer conversÃ£o (schema nÃ£o
--    exposto pelo PostgREST). Apagar depois de validar a migraÃ§Ã£o.
create schema if not exists backup;
create table if not exists backup.fotos_atendimentos_20260929 as
  select id, fotos from public.atendimentos where fotos::text like '%"data:%';
create table if not exists backup.fotos_inspecoes_20260929 as
  select id, fotos from public.inspecoes where fotos::text like '%"data:%';
create table if not exists backup.fotos_rvt_itens_20260929 as
  select id, outro_fotos from public.rvt_itens where outro_fotos::text like '%"data:%';
create table if not exists backup.fotos_intervencoes_20260929 as
  select id, fotos from public.atendimento_intervencoes where fotos::text like '%"data:%';
revoke all on schema backup from anon, authenticated;

-- 2) Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/*'])
on conflict (id) do nothing;

-- 3) Policies: mesmo controle das tabelas (has_client_access pela 1Âª pasta = cliente_id)
drop policy if exists fotos_select on storage.objects;
create policy fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.has_client_access((storage.foldername(name))[1]));
drop policy if exists fotos_insert on storage.objects;
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.has_client_access((storage.foldername(name))[1]));
drop policy if exists fotos_delete on storage.objects;
create policy fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

-- 4) Lista o que ainda tem base64 (usada pela migraÃ§Ã£o no app). SECURITY INVOKER:
--    RLS das tabelas vale normalmente.
create or replace function public.fotos_base64_pendentes()
returns table (tabela text, id text, cliente_id text)
language sql stable security invoker set search_path = public as $$
  select 'atendimentos', a.id::text, a.cliente_id from atendimentos a where a.fotos::text like '%"data:%'
  union all
  select 'inspecoes', i.id::text, i.cliente_id from inspecoes i where i.fotos::text like '%"data:%'
  union all
  select 'rvt_itens', ri.id::text, r.cliente_id from rvt_itens ri join rvts r on r.id = ri.rvt_id
    where ri.outro_fotos::text like '%"data:%'
  union all
  select 'atendimento_intervencoes', iv.id::text, coalesce(iv.cliente_id, a.cliente_id)
    from atendimento_intervencoes iv left join atendimentos a on a.id = iv.atendimento_id
    where iv.fotos::text like '%"data:%'
$$;
revoke all on function public.fotos_base64_pendentes() from public, anon;
grant execute on function public.fotos_base64_pendentes() to authenticated;

-- 5) FunÃ§Ãµes de RLS eram VOLATILE (default) â€” marcar STABLE deixa o planner
--    tratÃ¡-las melhor (sÃ³ leem tabelas, nunca escrevem).
alter function public.has_client_access(text) stable;
alter function public.is_admin() stable;

-- 6) Ãndices de FK que faltavam (advisor "unindexed_foreign_keys") â€” os usados
--    nos filtros/joins do loadClientData e dos embeds de atendimentos.
create index if not exists idx_dispositivos_cliente_id on public.dispositivos (cliente_id);
create index if not exists idx_dispositivos_laco_id on public.dispositivos (laco_id);
create index if not exists idx_dispositivos_painel_id on public.dispositivos (painel_id);
create index if not exists idx_paineis_cliente_id on public.paineis (cliente_id);
create index if not exists idx_lacos_painel_id on public.lacos (painel_id);
create index if not exists idx_rvts_cliente_id on public.rvts (cliente_id);
create index if not exists idx_rvts_painel_id on public.rvts (painel_id);
create index if not exists idx_rvt_itens_rvt_id on public.rvt_itens (rvt_id);
create index if not exists idx_rvt_itens_atendimento_id on public.rvt_itens (atendimento_id);
create index if not exists idx_rvt_itens_inspecao_id on public.rvt_itens (inspecao_id);
create index if not exists idx_atendimentos_dispositivo_id on public.atendimentos (dispositivo_id);
create index if not exists idx_atendimentos_bateria_painel_id on public.atendimentos (bateria_painel_id);
create index if not exists idx_atendimentos_fonte_auxiliar_id on public.atendimentos (fonte_auxiliar_id);
create index if not exists idx_atendimentos_origem_inspecao_id on public.atendimentos (origem_inspecao_id);
create index if not exists idx_inspecoes_dispositivo_id on public.inspecoes (dispositivo_id);
create index if not exists idx_inspecoes_bateria_painel_id on public.inspecoes (bateria_painel_id);
create index if not exists idx_inspecoes_fonte_auxiliar_id on public.inspecoes (fonte_auxiliar_id);
create index if not exists idx_baterias_painel_painel_id on public.baterias_painel (painel_id);
create index if not exists idx_saida_subitens_dispositivo_id on public.saida_subitens (dispositivo_id);
create index if not exists idx_combate_subitens_conjunto_id on public.combate_subitens (conjunto_id);
create index if not exists idx_combate_conjuntos_painel_id on public.combate_conjuntos (painel_id);
create index if not exists idx_combate_componentes_conjunto_id on public.combate_componentes (conjunto_id);
create index if not exists idx_combate_componentes_dispositivo_id on public.combate_componentes (dispositivo_id);
create index if not exists idx_combate_cilindros_bateria_id on public.combate_cilindros (bateria_id);
create index if not exists idx_combate_baterias_cilindros_painel_id on public.combate_baterias_cilindros (painel_id);
