-- WiTracEQUIP · 11 — Formulaire de contact de la page vitrine
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si relancé.
-- Les visiteurs (non connectés) peuvent UNIQUEMENT déposer une demande.
-- Personne ne peut les relire via l'application : consultez-les dans
-- Supabase > Table Editor > demandes_contact.
-- Tant que ce script n'est pas passé, le formulaire ouvre un e-mail prérempli.

create table if not exists public.demandes_contact (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nom           text not null check (char_length(nom) between 1 and 120),
  etablissement text not null check (char_length(etablissement) between 1 and 120),
  email         text not null check (char_length(email) between 5 and 200),
  telephone     text check (char_length(telephone) <= 40),
  secteur       text check (char_length(secteur) <= 60),
  message       text check (char_length(message) <= 2000),
  traite        boolean not null default false
);

alter table public.demandes_contact enable row level security;

drop policy if exists "contact_depot_public" on public.demandes_contact;
create policy "contact_depot_public" on public.demandes_contact
  for insert to anon, authenticated with check (true);

grant insert on public.demandes_contact to anon, authenticated;
