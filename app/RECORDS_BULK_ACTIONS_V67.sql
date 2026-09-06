-- Growr360 v67
-- Eliminación múltiple segura de registros/monitoreos, respetando permisos personalizados.
-- member_permission_overrides se relaciona con group_members por group_member_id.

create or replace function public.delete_records(p_record_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_record record;
  v_member_id uuid;
  v_role text;
  v_override_any boolean;
  v_override_own boolean;
  v_can_any boolean;
  v_can_own boolean;
  v_owner_id uuid;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_record_ids is null or cardinality(p_record_ids) = 0 then
    return 0;
  end if;

  for v_record in
    select r.id, r.group_id, to_jsonb(r) as payload
    from public.records r
    where r.id = any(p_record_ids)
      and r.deleted_at is null
  loop
    select gm.id, gm.role::text
      into v_member_id, v_role
    from public.group_members gm
    where gm.group_id = v_record.group_id
      and gm.user_id = v_user_id
      and gm.status = 'active'
    limit 1;

    if v_member_id is null then
      continue;
    end if;

    select mpo.allowed into v_override_any
    from public.member_permission_overrides mpo
    where mpo.group_member_id = v_member_id
      and mpo.permission = 'delete_any_records'
    order by mpo.updated_at desc
    limit 1;

    select mpo.allowed into v_override_own
    from public.member_permission_overrides mpo
    where mpo.group_member_id = v_member_id
      and mpo.permission = 'delete_own_records'
    order by mpo.updated_at desc
    limit 1;

    v_can_any := coalesce(v_override_any, v_role in ('owner','admin'));
    v_can_own := coalesce(v_override_own, v_role in ('owner','admin','agronomist'));

    -- Compatible con esquemas donde el autor se guarda como created_by o responsible_id.
    begin
      v_owner_id := nullif(v_record.payload->>'created_by','')::uuid;
    exception when others then
      v_owner_id := null;
    end;
    if v_owner_id is null then
      begin
        v_owner_id := nullif(v_record.payload->>'responsible_id','')::uuid;
      exception when others then
        v_owner_id := null;
      end;
    end if;

    if v_can_any or (v_can_own and v_owner_id = v_user_id) then
      update public.records
         set deleted_at = now()
       where id = v_record.id
         and deleted_at is null;
      if found then v_deleted := v_deleted + 1; end if;
    end if;
  end loop;

  return v_deleted;
end;
$$;

revoke all on function public.delete_records(uuid[]) from public;
grant execute on function public.delete_records(uuid[]) to authenticated;

notify pgrst, 'reload schema';
