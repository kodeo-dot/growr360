begin;

-- OAuth providers may not provide a surname. Allow the initial profile row to
-- exist incomplete; the app blocks access until the person completes it.
alter table public.profiles drop constraint if exists profiles_first_name_check;
alter table public.profiles drop constraint if exists profiles_last_name_check;
alter table public.profiles
  add constraint profiles_first_name_check check (length(trim(first_name)) <= 80),
  add constraint profiles_last_name_check check (length(trim(last_name)) <= 80);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_username_base text;
  v_username text;
  v_counter integer := 0;
begin
  v_full_name := trim(coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), ''));
  v_first_name := trim(coalesce(nullif(new.raw_user_meta_data->>'first_name',''), nullif(new.raw_user_meta_data->>'given_name',''), nullif(split_part(v_full_name,' ',1),''), ''));
  v_last_name := trim(coalesce(nullif(new.raw_user_meta_data->>'last_name',''), nullif(new.raw_user_meta_data->>'family_name',''), case when position(' ' in v_full_name)>0 then nullif(trim(substring(v_full_name from position(' ' in v_full_name)+1)),'') else null end, ''));
  v_first_name := left(v_first_name,80);
  v_last_name := left(v_last_name,80);

  v_username_base := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'usuario'));
  v_username_base := left(regexp_replace(v_username_base,'[^a-z0-9._-]','','g'),24);
  if length(v_username_base)<3 then v_username_base := 'usuario'; end if;
  v_username := v_username_base;
  while exists(select 1 from public.profiles where lower(username)=lower(v_username)) loop
    v_counter := v_counter + 1;
    v_username := left(v_username_base, greatest(3,30-length(v_counter::text))) || v_counter::text;
  end loop;

  insert into public.profiles(id,first_name,last_name,username,email)
  values(new.id,v_first_name,v_last_name,v_username,coalesce(new.email,''));
  return new;
end;
$$;

-- Personal identity is editable by its owner; protected account-level fields remain protected.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.default_role is distinct from old.default_role then
    raise exception 'No se pueden modificar campos protegidos';
  end if;
  return new;
end;
$$;

create or replace function public.complete_own_profile(
  p_first_name text,
  p_last_name text,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text := trim(coalesce(p_first_name,''));
  v_last text := trim(coalesce(p_last_name,''));
  v_username text := lower(trim(coalesce(p_username,'')));
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if length(v_first)<1 or length(v_first)>80 then raise exception 'Nombre inválido'; end if;
  if length(v_last)<1 or length(v_last)>80 then raise exception 'Apellido inválido'; end if;
  if v_username !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Nombre de usuario inválido'; end if;
  if exists(select 1 from public.profiles where lower(username)=v_username and id<>auth.uid()) then raise exception 'Ese nombre de usuario ya está en uso'; end if;

  update public.profiles
  set first_name=v_first,last_name=v_last,username=v_username,updated_at=now()
  where id=auth.uid();
end;
$$;

revoke all on function public.complete_own_profile(text,text,text) from public;
grant execute on function public.complete_own_profile(text,text,text) to authenticated;

commit;
