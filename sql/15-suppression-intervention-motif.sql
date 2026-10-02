-- WiTracEQUIP · 15 — Suppression d'une intervention avec motif obligatoire (ÉTAPE 1 : ajout seul)
-- À exécuter AVANT la mise en ligne de la v2.35.0. Ne retire aucun droit : l'application
-- actuelle continue de fonctionner exactement comme avant. Sans danger si relancé.
-- Retour arrière : 15-16-retour-arriere.sql
--
-- Qui peut supprimer : un responsable ou un administrateur de l'entreprise (et le fondateur).
-- Le motif est obligatoire pour le responsable (facultatif pour l'administrateur et le fondateur) ;
-- la suppression est toujours inscrite au journal avec une copie de l'intervention.

create or replace function public.supprimer_intervention(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_sa boolean;
  v_role text;
  v_motif text;
begin
  v_sa := is_super_admin();
  v_role := coalesce(current_profile_role(), '');

  if not v_sa and v_role not in ('admin', 'responsable') then
    raise exception 'Seul un responsable ou un administrateur peut supprimer une intervention.' using errcode = '42501';
  end if;

  v_motif := nullif(trim(coalesce(p_motif, '')), '');
  -- Seul le responsable doit justifier ; l'administrateur et le fondateur non (la trace reste au journal).
  if v_motif is null and not v_sa and v_role = 'responsable' then
    raise exception 'Le motif de suppression est obligatoire.' using errcode = '22023';
  end if;

  select i.id, i.date, i.type, i.technicien, i.description, i.photos,
         e.organization_id as org_id, e.nom as eq_nom, e.type_id as eq_type_id
    into r
    from interventions i
    join equipements e on e.id = i.equipement_id
   where i.id = p_id;

  if not found then
    raise exception 'Intervention introuvable.' using errcode = 'P0002';
  end if;

  -- Un responsable n'agit que sur son entreprise et sur les types d'équipement qu'il a le droit de voir.
  if not v_sa and (r.org_id is distinct from current_org_id() or not type_autorise(r.eq_type_id)) then
    raise exception 'Intervention introuvable.' using errcode = 'P0002';
  end if;

  -- Le déclencheur de suppression ne doit pas écrire une seconde ligne de journal sans motif.
  perform set_config('wte.suppression_en_cascade', 'on', true);

  perform journaliser(
    r.org_id, 'suppression_intervention', r.id,
    r.type || ' du ' || to_char(r.date, 'DD/MM/YYYY') || coalesce(' — ' || r.eq_nom, ''),
    v_motif,
    jsonb_build_object('equipement', r.eq_nom, 'date', r.date, 'type', r.type,
                       'technicien', r.technicien, 'description', r.description, 'photos', r.photos));

  delete from interventions where id = p_id;

  perform set_config('wte.suppression_en_cascade', 'off', true);
end;
$$;

revoke execute on function public.supprimer_intervention(uuid, text) from public, anon;
grant execute on function public.supprimer_intervention(uuid, text) to authenticated;

-- Modifier une intervention : motif obligatoire pour l'utilisateur ; le responsable, l'administrateur
-- et le fondateur n'ont pas à justifier (un motif facultatif est gardé au journal s'il est donné).
-- SECURITY INVOKER : les règles d'accès habituelles (entreprise, types autorisés) s'appliquent.
-- Le motif est transmis au déclencheur de journal (étape 16) par un réglage valable le temps de la requête.
-- Tant que l'étape 16 n'est pas lancée, le motif est simplement ignoré : sans danger.
create or replace function public.modifier_intervention(
  p_id uuid, p_date date, p_type text, p_technicien text,
  p_description text, p_photos jsonb, p_motif text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_motif text := nullif(trim(coalesce(p_motif, '')), '');
  n int;
begin
  if v_motif is null and not is_super_admin() and coalesce(current_profile_role(), '') not in ('admin', 'responsable') then
    raise exception 'Le motif de la modification est obligatoire.' using errcode = '22023';
  end if;
  perform set_config('wte.motif_modification', coalesce(v_motif, ''), true);
  update interventions
     set date = p_date, type = p_type, technicien = p_technicien,
         description = p_description, photos = coalesce(p_photos, photos)
   where id = p_id;
  get diagnostics n = row_count;
  perform set_config('wte.motif_modification', '', true);
  if n = 0 then
    raise exception 'Modification refusée ou intervention introuvable.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.modifier_intervention(uuid, date, text, text, text, jsonb, text) from public, anon;
grant execute on function public.modifier_intervention(uuid, date, text, text, text, jsonb, text) to authenticated;
