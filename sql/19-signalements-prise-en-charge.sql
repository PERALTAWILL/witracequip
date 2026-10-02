-- WiTracEQUIP · 19 — Prise en charge d'un signalement par tout membre + trace au journal
-- À exécuter une fois dans Supabase (SQL Editor), APRÈS les scripts 17 et 18. Sans danger si relancé.
-- Retour arrière : 19-retour-arriere.sql
--
-- 1. Tout membre de l'organisation (pas seulement responsable / administrateur) peut passer un
--    signalement « nouveau » en « pris en charge » (fonction prendre_en_charge_signalement).
--    Traité / rejeté / rouvrir / supprimer restent réservés au responsable et à l'administrateur.
-- 1bis. Tout membre peut aussi se rétracter : le signalement « pris en charge » redevient « nouveau »
--    (fonction retracter_prise_en_charge_signalement), et le journal le note.
-- 2. Tout changement de statut (pris en charge, traité, rejeté) est écrit au journal, avec le nom
--    de la personne. Le fil d'activité (page Journal) affiche ces lignes.

create or replace function public.prendre_en_charge_signalement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_n int;
begin
  if auth.uid() is null or current_org_id() is null then
    raise exception 'Connexion requise.' using errcode = 'P0001';
  end if;
  select coalesce(nullif(trim(p.full_name), ''), u.email) into v_nom
    from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  update signalements_panne
     set statut = 'pris_en_charge', traite_par = v_nom, traite_le = now()
   where id = p_id and organization_id = current_org_id() and statut = 'nouveau';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Ce signalement a déjà été pris en charge.' using errcode = 'P0001';
  end if;
end $$;

revoke execute on function public.prendre_en_charge_signalement(uuid) from public, anon;
grant execute on function public.prendre_en_charge_signalement(uuid) to authenticated;

create or replace function public.retracter_prise_en_charge_signalement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null or current_org_id() is null then
    raise exception 'Connexion requise.' using errcode = 'P0001';
  end if;
  update signalements_panne
     set statut = 'nouveau', traite_par = null, traite_le = null
   where id = p_id and organization_id = current_org_id() and statut = 'pris_en_charge';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Ce signalement n''est plus pris en charge.' using errcode = 'P0001';
  end if;
end $$;

revoke execute on function public.retracter_prise_en_charge_signalement(uuid) from public, anon;
grant execute on function public.retracter_prise_en_charge_signalement(uuid) to authenticated;

create or replace function public.journaliser_statut_signalement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eq text;
  v_action text;
begin
  if new.statut is not distinct from old.statut then return new; end if;
  v_action := case new.statut
    when 'nouveau' then case when old.statut = 'pris_en_charge' then 'signalement_retracte' end
    when 'pris_en_charge' then 'signalement_pris_en_charge'
    when 'traite' then 'signalement_traite'
    when 'rejete' then 'signalement_rejete'
    else null end;
  if v_action is null then return new; end if;
  select nom into v_eq from equipements where id = new.equipement_id;
  perform journaliser(new.organization_id, v_action, new.equipement_id,
                      coalesce(v_eq, 'Équipement') || ' — panne signalée par ' || new.auteur,
                      null, null);
  return new;
end $$;

drop trigger if exists trg_journal_statut_signalement on public.signalements_panne;
create trigger trg_journal_statut_signalement
  after update of statut on public.signalements_panne
  for each row execute function public.journaliser_statut_signalement();

-- Fil d'activité : mêmes règles qu'avant, + les trois actions de signalement.
create or replace function public.fil_activite()
returns table(cle text, le timestamptz, genre text, titre text, detail text, par text, equipement_id uuid, archivee boolean)
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid := current_org_id(); v_tout boolean;
begin
  if v_org is null then return; end if;
  delete from activite_archivee a where a.profile_id = auth.uid() and a.archive_le < now() - interval '8 days';
  select (p.role = 'admin' or p.acces_tous_types) into v_tout from profiles p where p.id = auth.uid();

  return query
  with f as (
    select 'iv:' || i.id as cle, i.created_at as le, 'intervention' as genre,
           i.type || ' — ' || e.nom as titre, i.description as detail, i.technicien as par,
           e.id as equipement_id
      from interventions i join equipements e on e.id = i.equipement_id
     where e.organization_id = v_org and i.created_at > now() - interval '7 days'
       and type_autorise(e.type_id)
    union all
    select 'eq:' || e.id, e.created_at, 'equipement_cree', e.nom,
           coalesce(t.nom, '') || coalesce(' · N/S ' || e.serial_value, ''), null::text, e.id
      from equipements e left join equipment_types t on t.id = e.type_id
     where e.organization_id = v_org and e.created_at > now() - interval '7 days'
       and type_autorise(e.type_id)
    union all
    select 'jr:' || j.id, j.le, j.action, j.libelle, j.motif, j.par_nom,
           case when j.action in ('archivage_equipement','restauration_equipement',
                                  'signalement_pris_en_charge','signalement_traite','signalement_rejete','signalement_retracte')
                then j.objet_id
                when j.action = 'modification_intervention'
                then (select iv.equipement_id from interventions iv where iv.id = j.objet_id)
           end
      from journal j
     where j.organization_id = v_org and j.le > now() - interval '7 days'
       and j.action in ('archivage_equipement','restauration_equipement','suppression_equipement',
                        'modification_intervention','suppression_intervention',
                        'signalement_pris_en_charge','signalement_traite','signalement_rejete','signalement_retracte')
       and (v_tout
            or exists (select 1 from equipements e2 where e2.id = j.objet_id and type_autorise(e2.type_id))
            or exists (select 1 from interventions i2 join equipements e3 on e3.id = i2.equipement_id
                        where i2.id = j.objet_id and type_autorise(e3.type_id)))
  )
  select f.cle, f.le, f.genre, f.titre, f.detail, f.par, f.equipement_id,
         exists (select 1 from activite_archivee a where a.profile_id = auth.uid() and a.cle = f.cle)
    from f order by f.le desc limit 300;
end $$;
