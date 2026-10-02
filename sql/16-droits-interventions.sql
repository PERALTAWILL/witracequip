-- WiTracEQUIP · 16 — Droits sur les interventions (ÉTAPE 2 : restrictions)
-- À exécuter SEULEMENT APRÈS la mise en ligne de la v2.35.0 (l'ancienne version de l'appli
-- afficherait un faux « enregistré » à un utilisateur dont la modification est refusée).
-- Prérequis : 15-suppression-intervention-motif.sql déjà exécuté.
-- Retour arrière : 15-16-retour-arriere.sql
--
-- Règles :
--   utilisateur  : ajoute des interventions, peut les modifier avec un motif obligatoire, ne peut pas les supprimer
--   responsable  : ajoute, modifie (sans motif), supprime (motif obligatoire, inscrit au journal)
--   administrateur (équipe WiTracEQUIP) et fondateur : tous les droits

-- 1) Modifier une intervention : ouvert à tous les membres (règle d'accès inchangée), mais
--    le journal exige un motif quand c'est un utilisateur qui modifie.
--    Responsable, administrateur et fondateur : motif facultatif.
create or replace function public.interventions_avant_modif()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $f$
declare v_org uuid; v_motif text;
begin
  if new.equipement_id is distinct from old.equipement_id then
    raise exception 'Une intervention ne peut pas changer d''équipement.';
  end if;
  if (new.date, new.type, new.technicien, new.description)
     is not distinct from (old.date, old.type, old.technicien, old.description) then
    return new;
  end if;
  if auth.uid() is not null then
    v_motif := nullif(trim(coalesce(current_setting('wte.motif_modification', true), '')), '');
    if v_motif is null and not is_super_admin() and coalesce(current_profile_role(), '') not in ('admin', 'responsable') then
      raise exception 'Le motif de la modification est obligatoire.' using errcode = '22023';
    end if;
    new.modifie_le  := now();
    new.modifie_par := nom_utilisateur_courant();
    select organization_id into v_org from equipements where id = old.equipement_id;
    perform journaliser(v_org, 'modification_intervention', old.id,
      old.type || ' du ' || to_char(old.date, 'DD/MM/YYYY'), v_motif,
      jsonb_build_object(
        'avant', jsonb_build_object('date', old.date, 'type', old.type, 'technicien', old.technicien, 'description', old.description),
        'apres', jsonb_build_object('date', new.date, 'type', new.type, 'technicien', new.technicien, 'description', new.description)));
  end if;
  return new;
end $f$;

-- 2) Supprimer une intervention : plus de suppression directe par un client.
--    Elle passe par supprimer_intervention() (motif obligatoire + journal).
drop policy if exists "iv: admin delete" on public.interventions;
drop policy if exists "iv: fondateur delete" on public.interventions;
create policy "iv: fondateur delete" on public.interventions
  for delete to public
  using (is_super_admin());

-- 3) Photos : un responsable peut supprimer les fichiers de son entreprise
--    (nécessaire pour effacer les photos d'une intervention qu'il supprime).
drop policy if exists "photos iv: suppression" on storage.objects;
create policy "photos iv: suppression" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'interventions'
    and (
      is_super_admin()
      or (
        (storage.foldername(name))[1] = (current_org_id())::text
        and current_profile_role() in ('admin', 'responsable')
      )
    )
  );

-- 4) Journal : tous les membres de l'entreprise (utilisateur, responsable, administrateur) le lisent ;
--    le fondateur lit celui de tous les clients. Lecture seule : personne d'autre que le fondateur ne peut le modifier.
drop policy if exists "journal: lecture" on public.journal;
create policy "journal: lecture" on public.journal
  for select to public
  using (is_super_admin() or organization_id = current_org_id());
