-- Growr360 v51 · disponibilidad de username/email durante el registro
-- Ejecutar una vez en Supabase > SQL Editor.

create or replace function public.check_signup_availability(
  p_username text default null,
  p_email text default null
)
returns table(username_available boolean, email_available boolean)
language sql
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
grant execute on function public.check_signup_availability(text,text) to anon, authenticated;
