-- Papel geral (profiles.role) editável pelo admin em Configurações.
-- O "Vincular" só grava memberships (papel por cliente); DDS/Checklist e is_maj_staff()
-- dependem do papel geral, que até hoje só mudava via SQL manual.
-- RPC em vez de policy de UPDATE: só mexe na coluna role, só operador/visualizador,
-- e nunca altera um perfil admin (evita rebaixar o dono por engano ou promover alguém a admin pela UI).

create or replace function public.definir_papel_global(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admin pode alterar o papel geral.';
  end if;
  if p_role not in ('operador', 'visualizador') then
    raise exception 'Papel geral inválido: %', p_role;
  end if;
  update public.profiles set role = p_role
   where id = p_user_id and role <> 'admin';
  if not found then
    raise exception 'Usuário não encontrado ou é admin.';
  end if;
end;
$$;

revoke all on function public.definir_papel_global(uuid, text) from public, anon;
grant execute on function public.definir_papel_global(uuid, text) to authenticated;

-- Corrige o caso que motivou a mudança (membro MAJ cadastrado como visualizador global)
update public.profiles set role = 'operador'
 where id = 'a163a66c-1b98-49e0-b549-813d866dd788' and role = 'visualizador'; -- matheus.alves@majsolucoes.com
