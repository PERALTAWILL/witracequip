-- 24b — Secret partagé entre les triggers et la fonction « notifier » (v9). DÉJÀ APPLIQUÉ en production le 06/10/2026.
-- Le secret est généré dans la base (jamais écrit dans ce dépôt) et stocké dans reglages_plateforme
-- (aucun droit pour anon/authenticated). Les triggers l'envoient dans l'en-tête x-notifier-secret ;
-- la fonction refuse (401) tout appel qui ne le porte pas.
insert into public.reglages_plateforme (cle, valeur)
values ('notifier_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (cle) do nothing;

create or replace function public.notifier_demande_support()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://oeqgyjyqdwlymlpfkdyn.supabase.co/functions/v1/notifier',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-notifier-secret', coalesce((select valeur from public.reglages_plateforme where cle = 'notifier_secret'), '')),
      body := jsonb_build_object('id', new.id));
  exception when others then null;
  end;
  return new;
end
$function$;

create or replace function public.notifier_signalement_panne()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://oeqgyjyqdwlymlpfkdyn.supabase.co/functions/v1/notifier',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-notifier-secret', coalesce((select valeur from public.reglages_plateforme where cle = 'notifier_secret'), '')),
      body := jsonb_build_object('id', new.id));
  exception when others then null;
  end;
  return new;
end
$function$;
