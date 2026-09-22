/* =========================================================================
   WiTracEQUIP — navigation
   -------------------------------------------------------------------------
   L'application navigue par le fragment d'URL (« #/equip/<id> ») et non par
   le chemin. Ce n'est pas un choix esthétique : c'est ce qui permet
   d'héberger l'application comme un simple fichier statique, chez n'importe
   quel hébergeur, sans règle de réécriture côté serveur.

   L'enjeu est direct : l'adresse inscrite dans un QR code collé sur un
   appareil doit fonctionner pour toujours. Une adresse qui dépend d'une
   configuration serveur est une adresse qui cassera le jour d'un changement
   d'hébergement — et avec elle, toutes les étiquettes déjà posées.

   Routes
   ------
     #/                    tableau de bord (liste des équipements)
     #/types               types d'équipement et modèles métiers
     #/equipe              gestion des profils (administrateur seulement)
     #/equip-new           création d'un équipement
     #/equip/<id>          fiche d'un équipement — cible des QR codes
     #/join/<token>        création de compte sur invitation (hors session)
   ========================================================================= */

import { state } from '../core/store.js';
import { APP_BASE_URL } from '../config.js';

/** Lit la route courante depuis l'adresse du navigateur. */
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'dashboard', param: parts[1] || null };
}

/** Change de page. */
export function nav(path) {
  location.hash = path;
}

/**
 * Branche l'écoute des changements d'adresse.
 * `auChangement` est appelé après mise à jour de state.route, avant le rendu :
 * c'est là que les modules de vue invalident leurs caches.
 */
export function initRouting(auChangement) {
  state.route = parseHash();
  window.addEventListener('hashchange', () => {
    state.route = parseHash();
    if (auChangement) auChangement(state.route);
  });
}

/* -------------------------------------------------------------------------
   ADRESSES PUBLIQUES
   -------------------------------------------------------------------------
   Toutes les adresses que l'application fabrique — QR codes, liens
   d'invitation — passent par ici, pour qu'il n'existe qu'un seul endroit où
   le domaine est décidé.
   ------------------------------------------------------------------------- */

/** Racine de toutes les adresses fabriquées. */
export function baseUrl() {
  const b = (APP_BASE_URL || '').trim();
  return b ? b.replace(/\/+$/, '') + '/' : (location.origin + location.pathname);
}

/** Vrai si le domaine définitif est configuré : sinon, imprimer est risqué. */
export function adresseDefinitive() {
  return !!(APP_BASE_URL || '').trim();
}

/** Adresse gravée dans le QR code d'un équipement. */
export function lienEquipement(id) {
  return baseUrl() + '#/equip/' + id;
}

/** Adresse d'un lien d'invitation. */
export function inviteUrl(token) {
  return baseUrl() + '#/join/' + token;
}
