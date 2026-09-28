-- WiTracEQUIP · 10 — Thème de couleur au choix, mémorisé dans le profil
-- À exécuter une fois dans Supabase (SQL Editor). Sans danger si relancé.
-- Tant qu'il n'est pas passé, l'appli garde le choix de couleur sur l'appareil seulement.

alter table public.profiles
  add column if not exists theme text;

alter table public.profiles
  drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check
  check (theme is null or theme in ('argile','saumon','bleu-nuit','violet','bordeaux','vert-fonce'));

-- Vérification : chacun doit pouvoir modifier son propre thème.
-- La photo de profil passe déjà par un update de profiles sur soi-même : si celle-ci
-- fonctionne, le thème fonctionnera aussi. Sinon, ajouter au besoin :
--   grant update (theme) on public.profiles to authenticated;
