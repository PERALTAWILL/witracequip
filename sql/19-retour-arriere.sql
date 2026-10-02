-- WiTracEQUIP · 19 — Retour arrière : retire la prise en charge par tout membre et la trace au journal.
-- (Le fil d'activité garde ses lignes de signalement jusqu'à 7 jours ; elles ne s'affichent plus
--  une fois le script 17 retiré. Pour revenir au fil d'avant, rejouer sa définition d'origine.)
drop trigger if exists trg_journal_statut_signalement on public.signalements_panne;
drop function if exists public.journaliser_statut_signalement();
drop function if exists public.prendre_en_charge_signalement(uuid);
drop function if exists public.retracter_prise_en_charge_signalement(uuid);
