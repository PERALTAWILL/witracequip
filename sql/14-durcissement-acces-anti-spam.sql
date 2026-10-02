-- WiTracEQUIP · 14 — Durcissement des accès + anti-spam du formulaire de contact
-- À exécuter une fois dans Supabase (SQL Editor). Retour arrière : 14-retour-arriere.sql
-- Sans effet sur le fonctionnement de l'appli : seul le fondateur utilise les rapports,
-- seul le formulaire de la vitrine écrit en tant que visiteur, et les fonctions
-- concernées ne sont appelées que par des utilisateurs connectés.

-- 1) Rapports : la règle « admins peuvent archiver » laissait passer tout le monde (using true).
--    Le fondateur reste couvert par la règle rapports_super_admin (ALL).
drop policy if exists "Les admins peuvent archiver un rapport" on public.rapports_intervention;

-- 2) Le visiteur non connecté n'a aucun droit direct sur ces tables.
revoke all on public.rapports_intervention from anon;
revoke all on public.profiles from anon;

-- 3) Formulaire de contact : seul le dépôt d'une demande est permis (visiteurs et connectés).
revoke all on public.demandes_contact from anon, authenticated;
grant insert on public.demandes_contact to anon, authenticated;

-- 4) Fonctions inutilement appelables sans connexion (les utilisateurs connectés gardent leur accès).
revoke execute on function public.liste_equipe() from public, anon;
revoke execute on function public.mon_modele_cle() from public, anon;
revoke execute on function public.notifier_demande_support() from public, anon;

-- 5) Anti-spam côté serveur (le champ piège du formulaire ne protège pas contre un
--    robot qui écrit directement dans la base).
--    Limites : 3 demandes par adresse et par heure, 30 au total par heure, 2 liens maximum.
--    Si la base refuse, le formulaire ouvre déjà un e-mail prérempli : un vrai visiteur n'est pas perdu.
create or replace function public.demandes_contact_anti_spam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mail int;
  v_global int;
  v_liens int;
begin
  if new.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Adresse e-mail invalide.';
  end if;

  v_liens := coalesce(array_length(regexp_split_to_array(lower(coalesce(new.message, '')), 'https?://'), 1), 1) - 1;
  if v_liens > 2 then
    raise exception 'Message refusé : trop de liens.';
  end if;

  select count(*) into v_mail
    from public.demandes_contact
   where lower(email) = lower(new.email) and created_at > now() - interval '1 hour';
  if v_mail >= 3 then
    raise exception 'Trop de demandes avec cette adresse. Réessayez plus tard.';
  end if;

  select count(*) into v_global
    from public.demandes_contact
   where created_at > now() - interval '1 hour';
  if v_global >= 30 then
    raise exception 'Trop de demandes en ce moment. Réessayez plus tard.';
  end if;

  return new;
end;
$$;

revoke execute on function public.demandes_contact_anti_spam() from public, anon, authenticated;

drop trigger if exists trg_contact_anti_spam on public.demandes_contact;
create trigger trg_contact_anti_spam
  before insert on public.demandes_contact
  for each row execute function public.demandes_contact_anti_spam();
