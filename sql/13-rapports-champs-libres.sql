-- WiTracEQUIP · 13 — Rapports d'intervention : champs facultatifs + client saisi librement
-- À exécuter une fois dans Supabase (SQL Editor), AVANT de mettre en ligne la v2.17.15.
-- Sans danger si relancé.

-- Nom de client saisi à la main (quand le client n'est pas dans la liste)
alter table public.rapports_intervention
  add column if not exists client_nom text;

-- Plus aucun champ obligatoire côté base
alter table public.rapports_intervention alter column organization_id    drop not null;
alter table public.rapports_intervention alter column nom_support        drop not null;
alter table public.rapports_intervention alter column date_intervention  drop not null;
alter table public.rapports_intervention alter column raison             drop not null;
alter table public.rapports_intervention alter column email_destinataire drop not null;
alter table public.rapports_intervention alter column signature_path     drop not null;
