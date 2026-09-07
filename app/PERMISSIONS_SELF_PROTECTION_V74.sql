-- Growr360 v73 — cumplimiento estricto de permisos personalizados
-- Los overrides (allowed=false/true) siempre tienen prioridad sobre el rol, incluso para admins.

create or replace function public.has_group_permission(p_group uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_member_id uuid;
  v_role text;
  v_override boolean;
begin
  if v_user is null or p_group is null or coalesce(trim(p_permission),'') = '' then return false; end if;

  select gm.id, gm.role::text
    into v_member_id, v_role
  from public.group_members gm
  where gm.group_id=p_group and gm.user_id=v_user and gm.status='active'
  limit 1;

  if v_member_id is null then return false; end if;
  if v_role='owner' then return true; end if;

  select mpo.allowed into v_override
  from public.member_permission_overrides mpo
  where mpo.group_member_id=v_member_id and mpo.permission=p_permission
  order by mpo.updated_at desc
  limit 1;

  if found then return v_override; end if;

  if v_role='admin' then
    return p_permission not in ('delete_group','manage_subscription','assign_admin_role','transfer_ownership');
  elsif v_role='agronomist' then
    return p_permission = any(array['view_fields','view_records','create_records','edit_records','delete_own_records','create_monitoring','view_satellite','view_ndvi','export_reports']);
  elsif v_role='operator' then
    return p_permission = any(array['view_fields','view_records','create_records','create_monitoring']);
  else
    return p_permission = any(array['view_fields','view_records']);
  end if;
end;
$$;

revoke all on function public.has_group_permission(uuid,text) from public;
grant execute on function public.has_group_permission(uuid,text) to authenticated;

-- Un admin con manage_members=false tampoco puede modificar permisos por RPC.
create or replace function public.set_member_permission_overrides(
  p_group_id uuid,
  p_user_id uuid,
  p_permissions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_member_id uuid;
  v_permission text;
  v_allowed boolean;
begin
  if v_actor is null then raise exception 'No autenticado'; end if;

  -- Nadie puede concederse, quitarse o alterar sus propios permisos.
  if p_user_id = v_actor then
    raise exception 'No podés modificar tus propios permisos. Otro responsable del grupo debe hacerlo.';
  end if;

  select gm.role::text into v_actor_role
  from public.group_members gm
  where gm.group_id=p_group_id and gm.user_id=v_actor and gm.status='active'
  limit 1;

  if v_actor_role <> 'owner' and not public.has_group_permission(p_group_id,'manage_members') then
    raise exception 'No tenés permiso para administrar permisos del equipo';
  end if;

  select gm.id into v_target_member_id
  from public.group_members gm
  where gm.group_id=p_group_id and gm.user_id=p_user_id and gm.status='active'
  limit 1;

  if v_target_member_id is null then raise exception 'El miembro no pertenece al grupo'; end if;

  for v_permission, v_allowed in
    select key, value::boolean from jsonb_each_text(coalesce(p_permissions,'{}'::jsonb))
  loop
    update public.member_permission_overrides
       set allowed=v_allowed, updated_at=now(), created_by=coalesce(created_by,v_actor)
     where group_member_id=v_target_member_id and permission=v_permission;
    if not found then
      insert into public.member_permission_overrides(group_member_id,permission,allowed,created_by)
      values(v_target_member_id,v_permission,v_allowed,v_actor);
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.set_member_permission_overrides(uuid,uuid,jsonb) from public;
grant execute on function public.set_member_permission_overrides(uuid,uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
