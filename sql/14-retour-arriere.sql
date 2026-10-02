-- WiTracEQUIP · 14 — RETOUR ARRIÈRE (remet la base dans l'état d'avant 14-durcissement-acces-anti-spam.sql)

drop trigger if exists trg_contact_anti_spam on public.demandes_contact;
drop function if exists public.demandes_contact_anti_spam();

grant execute on function public.liste_equipe() to public, anon;
grant execute on function public.mon_modele_cle() to public, anon;
grant execute on function public.notifier_demande_support() to public, anon;

grant all on public.demandes_contact to anon, authenticated;
grant all on public.profiles to anon;
grant all on public.rapports_intervention to anon;

-- Règle d'origine (trop large, à ne remettre que pour revenir exactement à l'état précédent)
drop policy if exists "Les admins peuvent archiver un rapport" on public.rapports_intervention;
create policy "Les admins peuvent archiver un rapport" on public.rapports_intervention
  for update to public using (true) with check (true);
