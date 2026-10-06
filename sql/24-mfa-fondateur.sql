-- =========================================================================
-- 24 — Double authentification du fondateur (à appliquer APRÈS activation)
-- -------------------------------------------------------------------------
-- NE PAS APPLIQUER avant d'avoir :
--   1. activé la double authentification (Espace fondateur → Double authentification),
--   2. enregistré un appareil de SECOURS,
--   3. testé une déconnexion / reconnexion avec le code.
-- Sinon vous vous enfermez dehors (retour arrière : sql/24-retour-arriere.sql).
--
-- Effet : tant que le compte super-admin a un facteur TOTP vérifié, ses pouvoirs
-- (is_super_admin) exigent une session de niveau « aal2 » (mot de passe + code).
-- Un mot de passe volé seul ne donne alors plus accès aux clients, même en appelant
-- l'API directement sans passer par l'application.
-- =========================================================================
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
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
  )
$function$;
