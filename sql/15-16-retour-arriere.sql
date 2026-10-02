-- WiTracEQUIP · 15-16 — RETOUR ARRIÈRE (remet les droits d'avant la v2.35.0)

-- Étape 2 annulée : tous les membres peuvent de nouveau modifier ; seul l'administrateur supprime.
drop policy if exists "iv: update via equip org" on public.interventions;
create policy "iv: update via equip org" on public.interventions
  for update to public
  using (is_super_admin() or exists (select 1 from equipements e
          where e.id = interventions.equipement_id and e.organization_id = current_org_id() and type_autorise(e.type_id)))
  with check (is_super_admin() or exists (select 1 from equipements e
          where e.id = interventions.equipement_id and e.organization_id = current_org_id() and type_autorise(e.type_id)));

drop policy if exists "iv: fondateur delete" on public.interventions;
drop policy if exists "iv: admin delete" on public.interventions;
create policy "iv: admin delete" on public.interventions
  for delete to public
  using (is_super_admin() or (current_profile_role() = 'admin' and exists (select 1 from equipements e
          where e.id = interventions.equipement_id and e.organization_id = current_org_id())));

drop policy if exists "photos iv: suppression" on storage.objects;
create policy "photos iv: suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'interventions'
         and (is_super_admin() or (((storage.foldername(name))[1] = (current_org_id())::text) and current_profile_role() = 'admin')));

-- Étape 1 annulée : la commande de suppression avec motif disparaît.
drop function if exists public.supprimer_intervention(uuid, text);
