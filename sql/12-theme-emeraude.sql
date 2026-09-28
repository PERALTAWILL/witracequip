-- WiTracEQUIP · 12 — Ajoute le thème « Émeraude » (couleurs de la page vitrine)
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si relancé.
-- Sans ce script, le thème fonctionne quand même, mais il n'est mémorisé que sur l'appareil.
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check
  check (theme is null or theme in ('emeraude','argile','saumon','bleu-nuit','violet','bordeaux','vert-fonce'));
