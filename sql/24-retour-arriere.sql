-- Retour arrière de sql/24-mfa-fondateur.sql : is_super_admin() sans condition de double authentification.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from super_admins s
    join profiles p      on p.id = s.user_id
    join organizations o on o.id = p.organization_id
    where s.user_id = auth.uid() and p.active and o.active
  )
$function$;
