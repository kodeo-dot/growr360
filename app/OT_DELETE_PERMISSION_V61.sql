-- Growr360 v61
-- Eliminación segura (soft delete) de órdenes de trabajo según permisos del grupo.
-- Los registros formales generados por una OT finalizada NO se eliminan.

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

  select gm.role
    into v_role
  from public.group_members gm
  where gm.group_id = v_group_id
    and gm.user_id = v_user_id
    and gm.status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'No tenés acceso a este grupo';
  end if;

  select mpo.allowed
    into v_override_any
  from public.member_permission_overrides mpo
  where mpo.group_id = v_group_id
    and mpo.user_id = v_user_id
    and mpo.permission = 'delete_any_records'
  limit 1;

  select mpo.allowed
    into v_override_own
  from public.member_permission_overrides mpo
  where mpo.group_id = v_group_id
    and mpo.user_id = v_user_id
    and mpo.permission = 'delete_own_records'
  limit 1;

  -- Los overrides explícitos tienen prioridad sobre el rol.
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
