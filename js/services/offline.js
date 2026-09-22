/* =========================================================================
   WiTracEQUIP — socle du mode hors connexion
   -------------------------------------------------------------------------
   Pourquoi ce module existe
   -------------------------
   Un local technique en sous-sol, une chaufferie, un parking couvert, un
   chantier à l'intérieur des terres : ce sont précisément les endroits où
   l'on scanne une étiquette, et précisément ceux où le réseau mobile tombe.
   Une application qui affiche « pas de connexion » à ce moment-là est une
   application qu'on n'utilise pas.

   Ce que ce module garantit
   -------------------------
   1. CONSULTATION — toute fiche déjà ouverte au moins une fois reste
      consultable hors ligne, avec son historique d'interventions.
   2. SAISIE — une intervention peut être enregistrée sans réseau. Elle est
      rangée dans une file d'attente locale, affichée comme « en attente »,
      et part dès que le réseau revient.
   3. VISIBILITÉ — l'utilisateur sait toujours s'il est en ligne et combien
      d'enregistrements attendent. Rien ne disparaît en silence.

   Ce que ce module NE fait PAS, et pourquoi
   -----------------------------------------
   La création d'un équipement et les modifications de fiche ne sont pas mises
   en file d'attente. Un équipement créé hors ligne n'a pas d'identifiant en
   base, donc pas de QR code imprimable ; et deux personnes modifiant la même
   fiche hors ligne produiraient un conflit qu'aucune règle automatique ne
   peut trancher honnêtement. L'intervention, elle, est un ajout à un
   historique : deux ajouts ne se contredisent jamais. C'est ce qui la rend
   synchronisable sans risque, et c'est pourquoi le hors-ligne s'arrête là
   pour l'instant (voir la feuille de route dans docs/AI_CONTEXT.md).

   Stockage
   --------
   localStorage, et non IndexedDB : les volumes en jeu (quelques dizaines de
   fiches de quelques kilo-octets) tiennent très largement dans le quota, et
   l'API synchrone évite toute une classe de bugs de séquencement. Chaque
   accès est malgré tout protégé : en navigation privée, ou quand le quota est
   plein, la lecture comme l'écriture peuvent lever une exception. Le mode
   hors ligne se dégrade alors sans empêcher l'application de fonctionner
   normalement en ligne.
   ========================================================================= */

import { OFFLINE } from '../config.js';
import { state, render } from '../core/store.js';
import { uuid } from '../core/dom.js';
import { creerIntervention } from './supabase.js';

const P = OFFLINE.prefixe_stockage;
const CLE_OUTBOX = P + 'outbox';
const CLE_INDEX_FICHES = P + 'fiches.index';
const CLE_TYPES = P + 'types';
const CLE_LISTE = P + 'liste';
const cleFiche = (id) => P + 'fiche.' + id;

/* -------------------------------------------------------------------------
   ACCÈS AU STOCKAGE, TOUJOURS PROTÉGÉ
   ------------------------------------------------------------------------- */

function lire(cle, defaut = null) {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch (e) {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    // Quota dépassé : on fait de la place en évinçant les fiches les plus
    // anciennes, puis on réessaie une fois. La file d'attente, elle, n'est
    // jamais évincée — elle contient du travail non encore enregistré.
    if (evincerFiches(10)) {
      try {
        localStorage.setItem(cle, JSON.stringify(valeur));
        return true;
      } catch (_) { /* on abandonne silencieusement */ }
    }
    return false;
  }
}

function effacer(cle) {
  try { localStorage.removeItem(cle); } catch (e) { /* sans conséquence */ }
}

/* -------------------------------------------------------------------------
   CACHE DES FICHES CONSULTÉES
   -------------------------------------------------------------------------
   Un index séparé garde l'ordre de consultation, ce qui permet d'évincer la
   fiche la plus anciennement ouverte quand le cache est plein.
   ------------------------------------------------------------------------- */

function evincerFiches(combien) {
  const index = lire(CLE_INDEX_FICHES, []);
  if (!index.length) return false;
  const aSupprimer = index.slice(0, combien);
  aSupprimer.forEach((id) => effacer(cleFiche(id)));
  try {
    localStorage.setItem(CLE_INDEX_FICHES, JSON.stringify(index.slice(combien)));
  } catch (e) { /* si même ça échoue, le navigateur est saturé */ }
  return true;
}

/** Range une fiche et son historique pour une consultation ultérieure hors ligne. */
export function mettreEnCacheFiche(id, equipement, interventions) {
  if (!id || !equipement) return;

  ecrire(cleFiche(id), {
    equipement,
    interventions: interventions || [],
    enregistreLe: new Date().toISOString(),
  });

  // L'identifiant repart en fin d'index : c'est la fiche la plus récemment vue.
  let index = lire(CLE_INDEX_FICHES, []).filter((x) => x !== id);
  index.push(id);
  while (index.length > OFFLINE.max_fiches_en_cache) {
    effacer(cleFiche(index.shift()));
  }
  ecrire(CLE_INDEX_FICHES, index);
}

/** Relit une fiche mise en cache, ou null si elle n'a jamais été consultée. */
export function lireFicheEnCache(id) {
  return lire(cleFiche(id), null);
}

/** Types d'équipement : nécessaires pour afficher les libellés des champs hors ligne. */
export function mettreEnCacheTypes(types) { ecrire(CLE_TYPES, types || []); }
export function lireTypesEnCache() { return lire(CLE_TYPES, []); }

/** Dernière liste d'équipements affichée, pour que le tableau de bord ne soit pas vide. */
export function mettreEnCacheListe(items) {
  ecrire(CLE_LISTE, { items: items || [], enregistreLe: new Date().toISOString() });
}
export function lireListeEnCache() { return lire(CLE_LISTE, null); }

/** Vide tout le cache local. Appelé à la déconnexion : les données d'un
    compte ne doivent pas rester lisibles par le suivant sur le même appareil. */
export function viderCache() {
  const index = lire(CLE_INDEX_FICHES, []);
  index.forEach((id) => effacer(cleFiche(id)));
  effacer(CLE_INDEX_FICHES);
  effacer(CLE_TYPES);
  effacer(CLE_LISTE);
  // La file d'attente n'est PAS vidée : elle contient du travail réel, qui
  // doit pouvoir partir à la reconnexion même après une déconnexion.
}

/* -------------------------------------------------------------------------
   FILE D'ATTENTE (OUTBOX)
   ------------------------------------------------------------------------- */

export function lireOutbox() {
  const file = lire(CLE_OUTBOX, []);
  return Array.isArray(file) ? file : [];
}

function ecrireOutbox(file) {
  ecrire(CLE_OUTBOX, file);
  state.outboxCount = file.length;
}

/**
 * Met une intervention en file d'attente.
 * Elle est aussi ajoutée immédiatement à la fiche en cache, pour que la
 * personne la voie apparaître dans l'historique sans attendre le réseau.
 */
export function mettreEnAttenteIntervention(payload) {
  const element = {
    id: uuid(),
    genre: 'intervention',
    payload,
    creeLe: new Date().toISOString(),
    tentatives: 0,
    erreur: null,
  };

  const file = lireOutbox();
  file.push(element);
  ecrireOutbox(file);

  // Reflet immédiat dans la fiche en cache.
  const fiche = lireFicheEnCache(payload.equipementId);
  if (fiche) {
    fiche.interventions = [
      { ...payload, id: element.id, en_attente: true, date: payload.date },
      ...(fiche.interventions || []),
    ];
    ecrire(cleFiche(payload.equipementId), fiche);
  }

  return element;
}

/** Les interventions en attente pour une fiche donnée, pour affichage. */
export function interventionsEnAttente(equipementId) {
  return lireOutbox()
    .filter((e) => e.genre === 'intervention' && e.payload.equipementId === equipementId)
    .map((e) => ({ ...e.payload, id: e.id, en_attente: true, erreur: e.erreur }));
}

/** Retire un élément de la file — utilisé pour abandonner un envoi refusé. */
export function abandonnerElement(elementId) {
  ecrireOutbox(lireOutbox().filter((e) => e.id !== elementId));
  render();
}

/* -------------------------------------------------------------------------
   SYNCHRONISATION
   ------------------------------------------------------------------------- */

/**
 * Distingue une panne de réseau d'un refus du serveur.
 *
 * La différence commande tout le comportement : sur une panne réseau on
 * garde l'élément et on réessaiera ; sur un refus du serveur (droits
 * insuffisants, équipement entre-temps archivé, contrainte violée) réessayer
 * indéfiniment ne ferait que masquer le problème. L'élément reste alors dans
 * la file, marqué en erreur, et l'utilisateur décide.
 */
function estPanneReseau(e) {
  if (!navigator.onLine) return true;
  const msg = String(e?.message || e).toLowerCase();
  return msg.includes('failed to fetch')
    || msg.includes('networkerror')
    || msg.includes('load failed')
    || msg.includes('network request failed');
}

let syncEnCours = false;

/**
 * Tente d'envoyer tout ce qui attend.
 * Sans effet si le réseau est absent, si une synchronisation tourne déjà, ou
 * si personne n'est connecté (une intervention a besoin d'une session valide
 * pour passer les politiques RLS).
 */
export async function synchroniser() {
  if (syncEnCours) return;
  if (!state.enLigne || !state.session) return;

  const file = lireOutbox();
  const aEnvoyer = file.filter((e) => !e.erreur);
  if (!aEnvoyer.length) return;

  syncEnCours = true;
  state.syncEnCours = true;
  render();

  let envoyes = 0;
  let restants = [...file];

  for (const element of aEnvoyer) {
    try {
      if (element.genre === 'intervention') {
        await creerIntervention(element.payload);
      }
      restants = restants.filter((e) => e.id !== element.id);
      envoyes += 1;
    } catch (err) {
      if (estPanneReseau(err)) {
        // Le réseau est retombé : on s'arrête, tout le reste attendra.
        state.enLigne = false;
        break;
      }
      // Refus du serveur : on garde l'élément, marqué, pour que la personne
      // le voie et tranche. Rien n'est jeté sans que ce soit dit.
      const message = err?.message || String(err);
      restants = restants.map((x) => (
        x.id === element.id
          ? { ...x, erreur: message, tentatives: x.tentatives + 1 }
          : x
      ));
    }
  }

  ecrireOutbox(restants);

  syncEnCours = false;
  state.syncEnCours = false;
  if (envoyes > 0) {
    state.syncMessage = envoyes === 1
      ? '1 intervention enregistrée a été envoyée.'
      : `${envoyes} interventions enregistrées ont été envoyées.`;
    setTimeout(() => { state.syncMessage = ''; render(); }, 6000);
  }
  render();

  return envoyes;
}

/* -------------------------------------------------------------------------
   DÉMARRAGE
   ------------------------------------------------------------------------- */

/**
 * Branche la surveillance du réseau.
 *
 * `navigator.onLine` ment volontiers : il dit « en ligne » dès qu'une
 * interface réseau existe, même derrière un portail captif ou un Wi-Fi sans
 * Internet. C'est pourquoi une synchronisation qui échoue en panne réseau
 * repasse l'état à « hors ligne » : c'est l'échec réel d'une requête, et non
 * la déclaration du navigateur, qui fait autorité.
 */
export function initOffline() {
  state.outboxCount = lireOutbox().length;
  state.enLigne = navigator.onLine !== false;

  window.addEventListener('online', () => {
    state.enLigne = true;
    render();
    synchroniser();
  });

  window.addEventListener('offline', () => {
    state.enLigne = false;
    render();
  });

  // Une reprise de réseau ne déclenche pas toujours l'événement 'online'
  // (changement de Wi-Fi, sortie de veille) : on retente aussi au retour de
  // l'application au premier plan.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      state.enLigne = true;
      synchroniser();
    }
  });
}
