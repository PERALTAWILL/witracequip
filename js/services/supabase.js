/* =========================================================================
   WiTracEQUIP — accès aux données (Supabase)
   -------------------------------------------------------------------------
   Ce module est le SEUL endroit du code qui parle à la base. Aucune vue
   n'appelle `sb.from(...)` directement : elle appelle une fonction d'ici.

   Cette discipline a une raison précise. Chaque requête ci-dessous s'exécute
   sous les politiques Row Level Security de Postgres, qui filtrent déjà par
   organisation et par métier. Aucune requête ne filtre donc explicitement sur
   `organization_id` en lecture : ce serait redondant, et surtout trompeur —
   un lecteur pourrait croire que c'est ce filtre-là qui protège les données,
   et le retirer un jour sans comprendre ce qu'il retire.

   En écriture, en revanche, `organization_id` est fourni explicitement :
   Postgres le vérifie (`with check`) mais ne le devine pas.
   ========================================================================= */

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

/* Le client est chargé par une balise <script> classique dans index.html, donc
   exposé en global. Les modules ES6 étant différés, il est toujours prêt ici. */
if (typeof window.supabase === 'undefined') {
  throw new Error(
    "La bibliothèque Supabase n'a pas pu être chargée. "
    + "Vérifiez la connexion réseau au premier lancement de l'application."
  );
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================================================================
   PROFIL ET ORGANISATION
   ========================================================================= */

/**
 * Charge le profil du compte connecté et le nom de son organisation.
 *
 * Un profil introuvable alors que la session est valide n'est pas une erreur
 * technique : c'est la signature d'un accès coupé côté base. Un profil ou une
 * organisation suspendus font renvoyer NULL à current_org_id(), et la
 * politique RLS masque alors la ligne à son propre titulaire.
 */
export async function chargerProfilEtOrg(userId) {
  const champs = 'id, organization_id, full_name, role, active';

  let { data: profile, error } = await sb
    .from('profiles').select(champs).eq('id', userId).maybeSingle();
  if (error) throw error;

  if (!profile) {
    // Le trigger d'inscription n'a peut-être pas encore tourné (latence rare
    // juste après la création d'un compte) : on laisse passer une seconde.
    await new Promise((r) => setTimeout(r, 800));
    const retry = await sb.from('profiles').select(champs).eq('id', userId).maybeSingle();
    if (retry.error || !retry.data) throw new Error('ACCES_SUSPENDU');
    profile = retry.data;
  }

  const { data: org } = await sb
    .from('organizations').select('nom').eq('id', profile.organization_id).maybeSingle();

  return { profile, orgName: org?.nom || '' };
}

/* =========================================================================
   TYPES D'ÉQUIPEMENT
   ========================================================================= */

export async function listTypes() {
  const { data, error } = await sb
    .from('equipment_types').select('id, nom, champs, created_at').order('nom');
  if (error) throw error;
  return data || [];
}

export async function creerType(organizationId, nom, champs) {
  const { error } = await sb.from('equipment_types')
    .insert({ organization_id: organizationId, nom, champs });
  if (error) throw error;
}

export async function creerTypes(lignes) {
  const { error } = await sb.from('equipment_types').insert(lignes);
  if (error) throw error;
}

export async function modifierType(id, nom, champs) {
  const { error } = await sb.from('equipment_types').update({ nom, champs }).eq('id', id);
  if (error) throw error;
}

/* =========================================================================
   ÉQUIPEMENTS
   ========================================================================= */

export async function listEquipements({ search, typeId, showArchived }) {
  let q = sb.from('equipements')
    .select('id, nom, serial_value, valeurs, archived, type_id, created_at')
    .order('created_at', { ascending: false });

  if (!showArchived) q = q.eq('archived', false);
  if (typeId) q = q.eq('type_id', typeId);
  if (search) q = q.ilike('nom', `%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getEquipement(id) {
  const { data, error } = await sb.from('equipements').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/* -------------------------------------------------------------------------
   RÈGLE MÉTIER — DÉTECTION DE DOUBLON PAR NUMÉRO DE SÉRIE
   -------------------------------------------------------------------------
   Validée dès le prototype et reprise telle quelle : la détection se fait
   sur le numéro de série UNIQUEMENT, jamais sur le nom. Deux véhicules
   peuvent légitimement s'appeler « Kangoo atelier » ; deux appareils ne
   portent pas le même numéro de série chez le même fabricant.

   Et c'est un AVERTISSEMENT, jamais un blocage. Deux fabricants différents
   peuvent réutiliser la même suite de caractères, et une erreur de frappe
   corrigée plus tard ne doit pas empêcher d'enregistrer un équipement qui
   est, lui, bien réel. Le logiciel signale ; la personne tranche.

   La comparaison ignore la casse et les espaces de bordure, car « ab-123-cd »
   et « AB-123-CD » désignent la même plaque. Le périmètre est celui que RLS
   accorde au profil : un doublon dans un métier qu'il ne voit pas ne lui sera
   pas signalé, et c'est le comportement voulu — l'alternative reviendrait à
   lui révéler l'existence d'équipements qui lui sont fermés.
   ------------------------------------------------------------------------- */
export async function chercherDoublonsSerie(serial, idAExclure = null) {
  const valeur = String(serial ?? '').trim();
  if (!valeur) return [];

  let q = sb.from('equipements')
    .select('id, nom, serial_value, archived, type_id')
    .ilike('serial_value', valeur)   // insensible à la casse, sans joker
    .limit(5);

  if (idAExclure) q = q.neq('id', idAExclure);

  const { data, error } = await q;
  if (error) throw error;

  // Filtre de sûreté : ilike sans joker est déjà une égalité insensible à la
  // casse, mais un numéro contenant « % » ou « _ » serait interprété comme un
  // motif. On revalide donc l'égalité stricte côté client.
  const cible = valeur.toLowerCase();
  return (data || []).filter((e) => String(e.serial_value ?? '').trim().toLowerCase() === cible);
}

export async function creerEquipement({ organizationId, typeId, nom, serial, valeurs }) {
  const { data, error } = await sb.from('equipements').insert({
    organization_id: organizationId,
    type_id: typeId,
    nom,
    serial_value: serial || null,
    valeurs,
    archived: false,
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function modifierEquipement(id, { nom, serial, valeurs }) {
  const { error } = await sb.from('equipements')
    .update({ nom, serial_value: serial || null, valeurs })
    .eq('id', id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------
   RÈGLE MÉTIER — RETRAIT TRAÇABLE
   -------------------------------------------------------------------------
   Un équipement n'est JAMAIS supprimé de la base : il est archivé. Sa fiche
   et son historique d'interventions restent consultables, parce qu'un carnet
   d'entretien qui perd ses pages au moment où l'appareil sort du parc ne
   prouve plus rien en cas de contrôle ou de litige.

   Le retrait exige deux informations, toutes deux obligatoires :
     - le MOTIF : pourquoi cet appareil ne fait plus partie du parc ;
     - l'OPÉRATEUR : qui a pris cette décision.
   Sans elles, l'archivage est refusé ici ET par la base (contrainte SQL
   ajoutée dans sql/04-tracabilite-retrait.sql).
   ------------------------------------------------------------------------- */
export async function archiverEquipement(id, { motif, operateur }) {
  const raison = String(motif ?? '').trim();
  const par = String(operateur ?? '').trim();

  if (!raison) throw new Error('Le motif du retrait est obligatoire.');
  if (!par) throw new Error("Le nom de l'opérateur qui retire l'équipement est obligatoire.");

  const { error } = await sb.from('equipements').update({
    archived: true,
    archive_reason: raison,
    archived_by: par,
    archived_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

/**
 * Remise en service.
 * Le motif et l'opérateur du retrait précédent sont effacés : ils décrivaient
 * un retrait qui n'a plus cours. L'historique des interventions, lui, n'est
 * jamais touché.
 */
export async function restaurerEquipement(id) {
  const { error } = await sb.from('equipements').update({
    archived: false,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
  }).eq('id', id);
  if (error) throw error;
}

/* =========================================================================
   INTERVENTIONS
   ========================================================================= */

export async function listInterventions(equipementId) {
  const { data, error } = await sb.from('interventions')
    .select('*').eq('equipement_id', equipementId).order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Enregistre une intervention.
 *
 * `technicien` est obligatoire — règle métier d'origine, doublée d'une
 * contrainte SQL (`check (btrim(technicien) <> '')`). C'est le nom qui
 * figurera au carnet en cas de contrôle : une intervention anonyme ne vaut
 * pas preuve, elle ne doit donc pas pouvoir être enregistrée.
 */
export async function creerIntervention({ equipementId, date, type, technicien, description }) {
  const { error } = await sb.from('interventions').insert({
    equipement_id: equipementId,
    date,
    type,
    technicien,
    description: description || null,
  });
  if (error) throw error;
}

/* =========================================================================
   ÉQUIPE — réservé aux administrateurs (RLS le vérifie)
   ========================================================================= */

export async function listMembers() {
  const { data, error } = await sb.from('profiles')
    .select('id, full_name, role, active, acces_tous_types, fondateur, created_at')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

/** Cloisonnement par métier : quels types chaque profil a le droit de voir. */
export async function listAcces() {
  const { data, error } = await sb.from('acces_types').select('profile_id, type_id');
  if (error) throw error;
  return data || [];
}

export async function setAccesTousTypes(id, valeur) {
  const { error } = await sb.from('profiles').update({ acces_tous_types: valeur }).eq('id', id);
  if (error) throw error;
}

export async function setAccesType(profileId, typeId, autoriser) {
  if (autoriser) {
    const { error } = await sb.from('acces_types').insert({ profile_id: profileId, type_id: typeId });
    if (error) throw error;
  } else {
    const { error } = await sb.from('acces_types').delete()
      .eq('profile_id', profileId).eq('type_id', typeId);
    if (error) throw error;
  }
}

export async function setMemberRole(id, role) {
  const { error } = await sb.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function setMemberActive(id, active) {
  const { error } = await sb.from('profiles').update({ active }).eq('id', id);
  if (error) throw error;
}

/**
 * Suppression définitive d'un profil.
 * Passe par une fonction SQL car effacer un compte dans `auth.users` dépasse
 * les droits d'une clé publiable. L'historique des interventions saisies par
 * cette personne est conservé : c'est du texte libre, pas une référence au
 * compte, précisément pour que le départ d'un technicien n'efface pas la
 * traçabilité de ce qu'il a fait.
 */
export async function supprimerProfil(profileId) {
  const { error } = await sb.rpc('supprimer_profil', { p_profile_id: profileId });
  if (error) throw error;
}

/* =========================================================================
   INVITATIONS
   ========================================================================= */

export async function listInvites() {
  const { data, error } = await sb.from('invites')
    .select('*').is('used_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  const maintenant = Date.now();
  return (data || []).filter((i) => new Date(i.expires_at).getTime() > maintenant);
}

export async function createInvite(organizationId, role, label, accesTousTypes, typesAutorises) {
  const { data, error } = await sb.from('invites').insert({
    organization_id: organizationId,
    role,
    label: label || null,
    acces_tous_types: accesTousTypes,
    types_autorises: accesTousTypes ? [] : typesAutorises,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function cancelInvite(id) {
  const { error } = await sb.from('invites').delete().eq('id', id);
  if (error) throw error;
}

/** Aperçu public d'une invitation : appelable sans être connecté. */
export async function invitePreview(token) {
  const { data, error } = await sb.rpc('invite_preview', { p_token: token });
  if (error) throw error;
  return (data && data[0]) || null;
}
