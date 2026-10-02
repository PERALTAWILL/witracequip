-- WiTracEQUIP · 17 — Signalement de panne par le personnel (sans compte)
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si relancé.
-- Retour arrière : 17-retour-arriere.sql
--
-- Principe : sur la fiche publique d'un équipement (scan du QR), une personne qui connaît
-- le code de signalement peut déposer une panne : nom prénom + description. L'heure est
-- posée par le serveur. Le responsable reçoit un e-mail et retrouve le signalement dans l'appli.
-- Le code est UN réglage global, modifiable par le seul fondateur. Il n'est écrit dans aucun
-- fichier du dépôt : il est posé directement en base (réglage « code_signalement »).
-- Les visiteurs n'ont AUCUN droit direct sur les tables : tout passe par les deux fonctions
-- ci-dessous, qui contrôlent le jeton du QR, le code et les limites d'envoi.

-- 1) Réglages globaux de la plateforme (aucune politique : seules les fonctions ci-dessous y accèdent)
create table if not exists public.reglages_plateforme (
  cle        text primary key,
  valeur     text not null default '',
  modifie_le timestamptz not null default now()
);
alter table public.reglages_plateforme enable row level security;
revoke all on public.reglages_plateforme from anon, authenticated;

insert into public.reglages_plateforme (cle, valeur)
values ('code_signalement', '')
on conflict (cle) do nothing;

-- 2) Signalements de panne
create table if not exists public.signalements_panne (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipement_id   uuid not null references public.equipements(id) on delete cascade,
  auteur          text not null check (char_length(auteur) between 2 and 120),
  description     text not null check (char_length(description) between 3 and 1000),
  statut          text not null default 'nouveau'
                    check (statut in ('nouveau', 'pris_en_charge', 'traite', 'rejete')),
  traite_par      text,
  traite_le       timestamptz,
  notifie_le      timestamptz
);
create index if not exists signalements_panne_org_idx
  on public.signalements_panne (organization_id, created_at desc);
create index if not exists signalements_panne_equip_idx
  on public.signalements_panne (equipement_id, created_at desc);

alter table public.signalements_panne enable row level security;

-- Lecture : les membres de l'organisation (et le fondateur).
drop policy if exists "signalements: lecture" on public.signalements_panne;
create policy "signalements: lecture" on public.signalements_panne
  for select to authenticated
  using (is_super_admin() or organization_id = current_org_id());

-- Suivi (prendre en charge, traité, rejeté) et suppression : responsable, administrateur, fondateur.
drop policy if exists "signalements: suivi" on public.signalements_panne;
create policy "signalements: suivi" on public.signalements_panne
  for update to authenticated
  using (is_super_admin()
         or (organization_id = current_org_id() and coalesce(current_profile_role(), '') in ('admin', 'responsable')))
  with check (is_super_admin()
         or (organization_id = current_org_id() and coalesce(current_profile_role(), '') in ('admin', 'responsable')));

drop policy if exists "signalements: suppression" on public.signalements_panne;
create policy "signalements: suppression" on public.signalements_panne
  for delete to authenticated
  using (is_super_admin()
         or (organization_id = current_org_id() and coalesce(current_profile_role(), '') in ('admin', 'responsable')));

-- Droits : aucun pour les visiteurs ; les connectés lisent, et ne modifient que le suivi.
revoke all on public.signalements_panne from anon, authenticated;
grant select on public.signalements_panne to authenticated;
grant update (statut, traite_par, traite_le) on public.signalements_panne to authenticated;
grant delete on public.signalements_panne to authenticated;

-- 3) Journal des tentatives de code (pour limiter les essais), jamais lisible depuis l'appli
create table if not exists public.signalements_tentatives (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  equipement_id   uuid,
  organization_id uuid,
  reussi          boolean not null
);
create index if not exists signalements_tentatives_equip_idx
  on public.signalements_tentatives (equipement_id, created_at desc);
create index if not exists signalements_tentatives_org_idx
  on public.signalements_tentatives (organization_id, created_at desc);
alter table public.signalements_tentatives enable row level security;
revoke all on public.signalements_tentatives from anon, authenticated;

-- 4) Contrôle commun : jeton du QR + code + limite d'essais.
--    Renvoie l'équipement concerné et code_ok. Un mauvais code n'est PAS une erreur : il est
--    renvoyé en réponse normale, sinon l'exception annulerait aussi l'enregistrement de la
--    tentative et la limite d'essais ne compterait jamais les échecs.
drop function if exists public.signalement_controler(uuid, text);
create or replace function public.signalement_controler(p_token uuid, p_code text)
returns table (equipement_id uuid, organization_id uuid, equipement_nom text, code_ok boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e record;
  v_code text;
  v_ok boolean;
  v_echecs_equip int;
  v_echecs_org int;
begin
  select e.id, e.organization_id, e.nom, e.archived
    into v_e
    from equipements e
    join organizations o on o.id = e.organization_id
   where (e.public_token = p_token or (e.id = p_token and e.ancien_lien_actif))
     and e.partage_public
     and o.active;

  if not found then
    raise exception 'Étiquette invalide.' using errcode = 'P0001';
  end if;
  if v_e.archived then
    raise exception 'Cet équipement est retiré du service.' using errcode = 'P0001';
  end if;

  -- Nettoyage des vieilles tentatives (garde la table minuscule)
  delete from signalements_tentatives where created_at < now() - interval '2 days';

  select count(*) into v_echecs_equip
    from signalements_tentatives t
   where t.equipement_id = v_e.id and not t.reussi and t.created_at > now() - interval '10 minutes';
  select count(*) into v_echecs_org
    from signalements_tentatives t
   where t.organization_id = v_e.organization_id and not t.reussi and t.created_at > now() - interval '1 hour';
  if v_echecs_equip >= 5 or v_echecs_org >= 20 then
    raise exception 'Trop d''essais. Réessayez dans quelques minutes.' using errcode = 'P0001';
  end if;

  select valeur into v_code from reglages_plateforme where cle = 'code_signalement';
  v_ok := coalesce(trim(v_code), '') <> ''
          and upper(trim(coalesce(p_code, ''))) = upper(trim(v_code));

  insert into signalements_tentatives (equipement_id, organization_id, reussi)
  values (v_e.id, v_e.organization_id, v_ok);

  return query select v_e.id, v_e.organization_id, v_e.nom, v_ok;
end $$;

revoke execute on function public.signalement_controler(uuid, text) from public, anon, authenticated;

-- 5) Vérifier seulement le code (ouvre le formulaire côté appli) : vrai ou faux.
--    Les autres cas (étiquette invalide, trop d'essais) lèvent une erreur lisible.
create or replace function public.verifier_code_signalement(p_token uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  select c.code_ok into v_ok from public.signalement_controler(p_token, p_code) c;
  return coalesce(v_ok, false);
end $$;

revoke execute on function public.verifier_code_signalement(uuid, text) from public;
grant execute on function public.verifier_code_signalement(uuid, text) to anon, authenticated;

-- 6) Déposer un signalement. Le code est revérifié à l'envoi : le formulaire seul ne suffit pas.
--    Limites : 5 signalements par équipement et par heure, 30 par organisation et par heure.
create or replace function public.signaler_panne(p_token uuid, p_code text, p_auteur text, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_auteur text := trim(coalesce(p_auteur, ''));
  v_desc text := trim(coalesce(p_description, ''));
  v_nb_equip int;
  v_nb_org int;
  v_deja boolean;
  v_id uuid;
  v_le timestamptz;
begin
  if char_length(v_auteur) < 2 or char_length(v_auteur) > 120 then
    raise exception 'Indiquez votre nom et prénom.' using errcode = 'P0001';
  end if;
  if char_length(v_desc) < 3 or char_length(v_desc) > 1000 then
    raise exception 'Décrivez la panne (3 à 1000 caractères).' using errcode = 'P0001';
  end if;

  select * into v_c from public.signalement_controler(p_token, p_code);
  if not coalesce(v_c.code_ok, false) then
    return jsonb_build_object('ok', false, 'erreur', 'Code incorrect.');
  end if;

  select count(*) into v_nb_equip
    from signalements_panne s
   where s.equipement_id = v_c.equipement_id and s.created_at > now() - interval '1 hour';
  select count(*) into v_nb_org
    from signalements_panne s
   where s.organization_id = v_c.organization_id and s.created_at > now() - interval '1 hour';
  if v_nb_equip >= 5 or v_nb_org >= 30 then
    raise exception 'Trop de signalements en ce moment. Prévenez directement votre responsable.' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from signalements_panne s
     where s.equipement_id = v_c.equipement_id
       and s.statut in ('nouveau', 'pris_en_charge')
       and s.created_at > now() - interval '24 hours'
  ) into v_deja;

  insert into signalements_panne (organization_id, equipement_id, auteur, description)
  values (v_c.organization_id, v_c.equipement_id, v_auteur, v_desc)
  returning id, created_at into v_id, v_le;

  return jsonb_build_object('ok', true, 'id', v_id, 'recu_le', v_le, 'deja_signale', v_deja);
end $$;

revoke execute on function public.signaler_panne(uuid, text, text, text) from public;
grant execute on function public.signaler_panne(uuid, text, text, text) to anon, authenticated;

-- 7) Code de signalement : lecture et modification réservées au fondateur.
create or replace function public.lire_code_signalement()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Réservé au fondateur.' using errcode = '42501';
  end if;
  return coalesce((select valeur from reglages_plateforme where cle = 'code_signalement'), '');
end $$;

revoke execute on function public.lire_code_signalement() from public, anon;
grant execute on function public.lire_code_signalement() to authenticated;

create or replace function public.definir_code_signalement(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_code text := trim(coalesce(p_code, ''));
begin
  if not is_super_admin() then
    raise exception 'Réservé au fondateur.' using errcode = '42501';
  end if;
  if char_length(v_code) < 4 or char_length(v_code) > 40 or v_code ~ '\s' then
    raise exception 'Le code doit faire de 4 à 40 caractères, sans espace.' using errcode = 'P0001';
  end if;
  insert into reglages_plateforme (cle, valeur, modifie_le)
  values ('code_signalement', v_code, now())
  on conflict (cle) do update set valeur = excluded.valeur, modifie_le = now();
  -- Le journal note le changement, jamais la valeur du code.
  perform journaliser(current_org_id(), 'code_signalement_modifie', null,
                      'Code de signalement de panne modifié', null, null);
end $$;

revoke execute on function public.definir_code_signalement(text) from public, anon;
grant execute on function public.definir_code_signalement(text) to authenticated;

-- 8) Alerte e-mail : même mécanique que le support (déclencheur → fonction « notifier » → Brevo).
--    Un échec d'envoi ne bloque jamais le dépôt du signalement.
create or replace function public.notifier_signalement_panne()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform net.http_post(
      url := 'https://oeqgyjyqdwlymlpfkdyn.supabase.co/functions/v1/notifier',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('id', new.id));
  exception when others then null;
  end;
  return new;
end $$;

revoke execute on function public.notifier_signalement_panne() from public, anon, authenticated;

drop trigger if exists trg_notif_signalement on public.signalements_panne;
create trigger trg_notif_signalement
  after insert on public.signalements_panne
  for each row execute function public.notifier_signalement_panne();
