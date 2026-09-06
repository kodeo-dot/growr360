-- Growr360 v62 · reparar verificación de username/email en registro
-- Ejecutar en Supabase > SQL Editor.

create or replace function public.check_signup_availability(
  p_username text default null,
  p_email text default null
)
returns table(username_available boolean, email_available boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    case
      when nullif(trim(p_username), '') is null then null
      else not exists (
        select 1
        from public.profiles p
        where lower(trim(p.username)) = lower(trim(p_username))
      )
    end as username_available,
    case
      when nullif(trim(p_email), '') is null then null
      else not exists (
        select 1
        from auth.users u
        where lower(trim(u.email)) = lower(trim(p_email))
      )
    end as email_available;
$$;

revoke all on function public.check_signup_availability(text,text) from public;
grant usage on schema public to anon, authenticated;
grant execute on function public.check_signup_availability(text,text) to anon, authenticated;

-- Fuerza a PostgREST a recargar el schema cache para que detecte inmediatamente la RPC.
notify pgrst, 'reload schema';
