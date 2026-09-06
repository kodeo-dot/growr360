-- Growr360 v63
-- Corrige la relación de permisos: member_permission_overrides se vincula por group_member_id.

create or replace function public.delete_work_order(p_work_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_role text;
  v_group_member_id uuid;
  v_override_any boolean;
  v_override_own boolean;
  v_can_delete_any boolean := false;
  v_can_delete_own boolean := false;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select wo.group_id, wo.created_by
    into v_group_id, v_created_by
  from public.work_orders wo
  where wo.id = p_work_order_id
    and wo.deleted_at is null;

  if v_group_id is null then
    raise exception 'La orden no existe o ya fue eliminada';
  end if;

  select gm.id, gm.role::text
    into v_group_member_id, v_role
  from public.group_members gm
  where gm.group_id = v_group_id
    and gm.user_id = v_user_id
    and gm.status = 'active'
  limit 1;

  if v_group_member_id is null then
    raise exception 'No tenés acceso a este grupo';
  end if;

  select mpo.allowed
    into v_override_any
  from public.member_permission_overrides mpo
  where mpo.group_member_id = v_group_member_id
    and mpo.permission = 'delete_any_records'
  order by mpo.updated_at desc
  limit 1;

  select mpo.allowed
    into v_override_own
  from public.member_permission_overrides mpo
  where mpo.group_member_id = v_group_member_id
    and mpo.permission = 'delete_own_records'
  order by mpo.updated_at desc
  limit 1;

  v_can_delete_any := coalesce(v_override_any, v_role in ('owner', 'admin'));
  v_can_delete_own := coalesce(v_override_own, v_role in ('owner', 'admin', 'agronomist'));

  if not v_can_delete_any and not (v_can_delete_own and v_created_by = v_user_id) then
    raise exception 'No tenés permiso para eliminar esta orden de trabajo';
  end if;

  update public.work_orders
  set deleted_at = now(),
      updated_at = now()
  where id = p_work_order_id
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.delete_work_order(uuid) from public;
grant execute on function public.delete_work_order(uuid) to authenticated;

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
  if v_actor is null then
    raise exception 'No autenticado';
  end if;

  select gm.role::text
    into v_actor_role
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = v_actor
    and gm.status = 'active'
  limit 1;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'No tenés permiso para administrar permisos del equipo';
  end if;

  select gm.id
    into v_target_member_id
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id
    and gm.status = 'active'
  limit 1;

  if v_target_member_id is null then
    raise exception 'El miembro no pertenece al grupo';
  end if;

  for v_permission, v_allowed in
    select key, value::boolean
    from jsonb_each_text(coalesce(p_permissions, '{}'::jsonb))
  loop
    update public.member_permission_overrides
       set allowed = v_allowed,
           updated_at = now(),
           created_by = coalesce(created_by, v_actor)
     where group_member_id = v_target_member_id
       and permission = v_permission;

    if not found then
      insert into public.member_permission_overrides(
        group_member_id, permission, allowed, created_by
      ) values (
        v_target_member_id, v_permission, v_allowed, v_actor
      );
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.set_member_permission_overrides(uuid,uuid,jsonb) from public;
grant execute on function public.set_member_permission_overrides(uuid,uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
