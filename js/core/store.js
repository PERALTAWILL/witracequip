/* =========================================================================
   WiTracEQUIP — état applicatif partagé
   -------------------------------------------------------------------------
   Un seul objet `state` décrit à tout instant ce que l'application affiche.
   Chaque module le lit et le modifie, puis appelle `render()` : il n'y a pas
   d'autre mécanisme de mise à jour de l'écran, et c'est volontaire.

   Pourquoi un module dédié plutôt que des variables globales :
   `render()` est défini dans js/app.js, qui importe tous les modules de vue.
   Si ces modules importaient `render` depuis app.js, on obtiendrait un cycle
   d'imports. Ce module, qui ne dépend de rien, casse le cycle : app.js y
   dépose sa fonction de rendu avec `setRenderer()`, les modules appellent
   `render()` sans jamais connaître app.js.
   ========================================================================= */

/* -------------------------------------------------------------------------
   L'ÉTAT
   ------------------------------------------------------------------------- */
export const state = {
  session: null,      // session Supabase, ou null si déconnecté
  profile: null,      // { id, organization_id, full_name, role, active, ... }
  orgName: '',        // nom de l'organisation, affiché dans la barre du haut
  route: { name: 'dashboard', param: null },
  types: [],          // types d'équipement visibles par ce profil
  typesLoaded: false,
  loading: true,      // vrai tant que la session n'est pas déterminée
  authError: '',
  authNotice: '',
  authBusy: false,
  accessError: '',    // 'ACCES_SUSPENDU' ou message d'erreur au chargement du profil

  /* Mode hors connexion — alimenté par js/services/offline.js */
  enLigne: navigator.onLine !== false,
  outboxCount: 0,     // nombre d'enregistrements en attente d'envoi
  syncEnCours: false,
  syncMessage: '',    // message temporaire après une synchronisation
};

/* -------------------------------------------------------------------------
   RENDU
   ------------------------------------------------------------------------- */
let renderer = null;

/** Enregistre la fonction de rendu réelle. Appelé une seule fois, par app.js. */
export function setRenderer(fn) {
  renderer = fn;
}

/**
 * Redessine l'écran.
 * Sans effet tant que app.js n'a pas appelé setRenderer() : les modules
 * peuvent donc appeler render() dès le chargement sans précaution.
 */
export function render() {
  if (renderer) renderer();
}

/* -------------------------------------------------------------------------
   DROITS
   -------------------------------------------------------------------------
   Rappel : ces fonctions ne protègent rien. Elles décident seulement quels
   boutons sont visibles. La vraie autorisation est appliquée par Postgres
   (Row Level Security), qui refusera l'écriture même si le bouton est forcé.
   ------------------------------------------------------------------------- */
export function isAdmin() {
  return state.profile?.role === 'admin';
}

export function peutSupprimer() {
  return ['admin', 'responsable'].includes(state.profile?.role);
}

/* -------------------------------------------------------------------------
   RÉINITIALISATION À LA DÉCONNEXION
   Vider l'état est une exigence de cloisonnement : sans cela, les types
   d'équipement du compte précédent resteraient visibles le temps d'un
   rendu au compte suivant sur le même appareil.
   ------------------------------------------------------------------------- */
export function resetSessionState() {
  state.profile = null;
  state.orgName = '';
  state.types = [];
  state.typesLoaded = false;
  state.accessError = '';
}
