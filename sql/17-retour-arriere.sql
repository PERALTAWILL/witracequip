-- WiTracEQUIP · 17 — Retour arrière du signalement de panne
-- ATTENTION : supprime aussi les signalements déjà enregistrés et le code de signalement.
-- À n'exécuter que pour retirer entièrement la fonction.

drop trigger if exists trg_notif_signalement on public.signalements_panne;
drop function if exists public.notifier_signalement_panne();
drop function if exists public.definir_code_signalement(text);
drop function if exists public.lire_code_signalement();
drop function if exists public.signaler_panne(uuid, text, text, text);
drop function if exists public.verifier_code_signalement(uuid, text);
drop function if exists public.signalement_controler(uuid, text);
drop table if exists public.signalements_tentatives;
drop table if exists public.signalements_panne;
drop table if exists public.reglages_plateforme;
