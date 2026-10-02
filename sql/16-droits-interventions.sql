-- WiTracEQUIP · 16 — Droits sur les interventions (ÉTAPE 2 : restrictions)
-- À exécuter SEULEMENT APRÈS la mise en ligne de la v2.35.0 (l'ancienne version de l'appli
-- afficherait un faux « enregistré » à un utilisateur dont la modification est refusée).
-- Prérequis : 15-suppression-intervention-motif.sql déjà exécuté.
-- Retour arrière : 15-16-retour-arriere.sql
--
-- Règles :
--   utilisateur  : ajoute des interventions, ne peut ni les modifier ni les supprimer
--   responsable  : ajoute, modifie, supprime (motif obligatoire, inscrit au journal)
--   administrateur (équipe WiTracEQUIP) et fondateur : tous les droits

-- 1) Modifier une intervention : responsable, administrateur ou fondateur.
drop policy if exists "iv: update via equip org" on public.interventions;
create policy "iv: update via equip org" on public.interventions
  for update to public
  using (
    is_super_admin() or (
      current_profile_role() in ('admin', 'responsable')
      and exists (select 1 from equipements e
                   where e.id = interventions.equipement_id
                     and e.organization_id = current_org_id()
                     and type_autorise(e.type_id))))
  with check (
    is_super_admin() or (
      current_profile_role() in ('admin', 'responsable')
      and exists (select 1 from equipements e
                   where e.id = interventions.equipement_id
                     and e.organization_id = current_org_id()
                     and type_autorise(e.type_id))));

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
