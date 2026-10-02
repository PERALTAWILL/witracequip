-- WiTracEQUIP · 15-16 — RETOUR ARRIÈRE (remet les droits d'avant la v2.35.0)

-- Étape 2 annulée : ancien déclencheur de journal (sans motif) ; seul l'administrateur supprime.
create or replace function public.interventions_avant_modif()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $f$
declare v_org uuid;
begin
  if new.equipement_id is distinct from old.equipement_id then
    raise exception 'Une intervention ne peut pas changer d''équipement.';
  end if;
  if (new.date, new.type, new.technicien, new.description)
     is not distinct from (old.date, old.type, old.technicien, old.description) then
    return new;
  end if;
  if auth.uid() is not null then
    new.modifie_le  := now();
    new.modifie_par := nom_utilisateur_courant();
    select organization_id into v_org from equipements where id = old.equipement_id;
    perform journaliser(v_org, 'modification_intervention', old.id,
      old.type || ' du ' || to_char(old.date, 'DD/MM/YYYY'), null,
      jsonb_build_object(
        'avant', jsonb_build_object('date', old.date, 'type', old.type, 'technicien', old.technicien, 'description', old.description),
        'apres', jsonb_build_object('date', new.date, 'type', new.type, 'technicien', new.technicien, 'description', new.description)));
  end if;
  return new;
end $f$;

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
drop function if exists public.modifier_intervention(uuid, date, text, text, text, jsonb, text);

-- Journal : de nouveau réservé à l'administrateur de l'entreprise et au fondateur.
drop policy if exists "journal: lecture" on public.journal;
create policy "journal: lecture" on public.journal
  for select to public
  using (is_super_admin() or (organization_id = current_org_id() and current_profile_role() = 'admin'));
