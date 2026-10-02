-- WiTracEQUIP · 18 — Photo facultative sur un signalement de panne (casse, dégât…)
-- À exécuter une fois dans Supabase (SQL Editor), APRÈS le script 17. Sans danger si relancé.
-- Retour arrière : 18-retour-arriere.sql
--
-- La photo est réduite côté téléphone (JPEG d'environ 1280 px) puis envoyée avec le signalement,
-- par la même fonction que le texte : le code de l'établissement et les limites d'envoi s'appliquent
-- donc aussi à la photo. Aucun accès direct au stockage n'est ouvert aux visiteurs.
-- Garde-fous : JPEG uniquement, 700 000 caractères maximum, 15 photos par organisation et par jour.

alter table public.signalements_panne add column if not exists photo text;

alter table public.signalements_panne drop constraint if exists signalements_panne_photo_check;
alter table public.signalements_panne add constraint signalements_panne_photo_check
  check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 700000));

-- Indicateur léger pour la liste (évite de charger les photos de tous les signalements).
alter table public.signalements_panne
  add column if not exists a_photo boolean generated always as (photo is not null) stored;

-- La fonction passe de 4 à 5 paramètres (photo facultative). L'ancienne signature est retirée ;
-- un appel à 4 paramètres fonctionne toujours (photo par défaut à null).
drop function if exists public.signaler_panne(uuid, text, text, text);

create or replace function public.signaler_panne(
  p_token uuid, p_code text, p_auteur text, p_description text, p_photo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_auteur text := trim(coalesce(p_auteur, ''));
  v_desc text := trim(coalesce(p_description, ''));
  v_photo text := nullif(trim(coalesce(p_photo, '')), '');
  v_nb_equip int;
  v_nb_org int;
  v_nb_photos int;
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
  if v_photo is not null
     and (v_photo not like 'data:image/jpeg;base64,%' or char_length(v_photo) > 700000) then
    raise exception 'Photo invalide ou trop lourde. Réessayez avec une autre photo, ou sans photo.' using errcode = 'P0001';
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

  if v_photo is not null then
    select count(*) into v_nb_photos
      from signalements_panne s
     where s.organization_id = v_c.organization_id and s.photo is not null
       and s.created_at > now() - interval '1 day';
    if v_nb_photos >= 15 then
      raise exception 'Limite de photos atteinte pour aujourd''hui. Envoyez le signalement sans photo.' using errcode = 'P0001';
    end if;
  end if;

  select exists (
    select 1 from signalements_panne s
     where s.equipement_id = v_c.equipement_id
       and s.statut in ('nouveau', 'pris_en_charge')
       and s.created_at > now() - interval '24 hours'
  ) into v_deja;

  insert into signalements_panne (organization_id, equipement_id, auteur, description, photo)
  values (v_c.organization_id, v_c.equipement_id, v_auteur, v_desc, v_photo)
  returning id, created_at into v_id, v_le;

  return jsonb_build_object('ok', true, 'id', v_id, 'recu_le', v_le, 'deja_signale', v_deja);
end $$;

revoke execute on function public.signaler_panne(uuid, text, text, text, text) from public;
grant execute on function public.signaler_panne(uuid, text, text, text, text) to anon, authenticated;
