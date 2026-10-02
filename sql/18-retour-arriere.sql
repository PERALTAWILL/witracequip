-- WiTracEQUIP · 18 — Retour arrière de la photo sur les signalements
-- ATTENTION : supprime les photos déjà jointes aux signalements.

drop function if exists public.signaler_panne(uuid, text, text, text, text);

alter table public.signalements_panne drop constraint if exists signalements_panne_photo_check;
alter table public.signalements_panne drop column if exists a_photo;
alter table public.signalements_panne drop column if exists photo;

-- Remet la fonction à 4 paramètres (version du script 17 corrigé).
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
