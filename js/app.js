/* =========================================================================
   WiTracEQUIP — point d'entrée
   -------------------------------------------------------------------------
   Ce fichier assemble l'application : il compose l'écran à partir des vues,
   branche les événements, et démarre la session.

   Modèle de rendu
   ---------------
   Il n'y a ni framework ni moteur de rendu incrémental. Chaque appel à
   render() reconstruit l'intégralité du HTML de la page et l'affecte à
   innerHTML. C'est grossier et parfaitement adapté à la taille du produit :
   les écrans tiennent en quelques dizaines d'éléments, et cette approche
   supprime d'un coup toute une classe de bugs où l'affichage diverge de
   l'état réel.

   Elle impose en contrepartie deux disciplines, toutes deux nées d'incidents
   réels et à respecter sans exception :

     1. Les éléments <canvas> sont recréés vides à chaque rendu. Le QR code
        doit donc être redessiné après chaque render() de la fiche — sinon
        l'étiquette imprimée sort vierge.

     2. Le contenu d'un champ en cours de saisie est perdu si render() est
        appelé pendant la frappe. Les gestionnaires de saisie mettent donc
        l'état à jour SANS redessiner, sauf quand le redessin est justement
        l'effet recherché (changement de type, coche d'une option).

   Événements
   ----------
   Plutôt que d'attacher des écouteurs à chaque rendu — ce qui les
   multiplierait sans fin —, trois écouteurs uniques sont posés sur le
   document et dispatchent selon l'attribut `data-action`. Un bouton créé par
   n'importe quelle vue fonctionne donc immédiatement, sans branchement.
   ========================================================================= */

import { state, render as demanderRendu, setRenderer, isAdmin } from './core/store.js';
import { esc, initials, debounce, ICONE_OEIL, ICONE_OEIL_BARRE } from './core/dom.js';

import { initRouting, nav } from './modules/routing.js';
import {
  renderAuth, renderAccesSuspendu, renderJoin, handleAuthSubmit,
  handleJoinSubmit, initAuth, logout,
} from './modules/auth.js';
import {
  viewDashboard, viewEquipNew, viewEquipDetail, dashboardCache, refreshDashboard,
  resetDashboardCache, resetEquipForm, saveEquip, equipFormInput, submitEditEquip,
  submitIntervention, soumettreRetrait, remettreEnService, imprimerEtiquette,
  equipDetail, invaliderFiche,
} from './modules/equipements.js';
import {
  viewTypes, saveType, appliquerModele, basculerTypeForm, editerType,
  typeFormInput, resetTypesState,
} from './modules/types.js';
import {
  viewEquipe, viewNonAutorise, resetEquipeCache, actionCreerInvite, actionAnnulerInvite,
  actionRoleMembre, actionSupprimerMembre, actionActiverMembre, actionAccesTous,
  actionAccesType, copierLienInvitation, inviteInput,
} from './modules/equipe.js';
import { initOffline, synchroniser } from './services/offline.js';

const LOGO = 'assets/icons/icon-512.png';

/* =========================================================================
   RENDU
   ========================================================================= */

function render() {
  const app = document.getElementById('app');

  if (state.loading) {
    app.innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
    return;
  }
  if (state.accessError) {
    app.innerHTML = renderAccesSuspendu();
    return;
  }
  if (!state.session) {
    // Un lien d'invitation est accessible sans être connecté : c'est par lui
    // que naissent tous les comptes.
    if (state.route.name === 'join' && state.route.param) {
      app.innerHTML = renderJoin(state.route.param);
      return;
    }
    app.innerHTML = renderAuth();
    return;
  }
  app.innerHTML = renderShell();
}

function renderShell() {
  const r = state.route;
  let content = '';
  try {
    if (r.name === 'dashboard') content = viewDashboard();
    else if (r.name === 'types') content = viewTypes();
    else if (r.name === 'equip-new') content = viewEquipNew();
    else if (r.name === 'equip') content = viewEquipDetail(r.param);
    else if (r.name === 'equipe') content = isAdmin() ? viewEquipe() : viewNonAutorise();
    else content = viewDashboard();
  } catch (e) {
    // Une vue qui casse ne doit pas laisser un écran blanc : l'utilisateur
    // doit au moins pouvoir naviguer ailleurs ou se déconnecter.
    content = `<div class="alert alert-error">Erreur d'affichage : ${esc(e.message || e)}</div>`;
  }

  return `
    <div class="topbar">
      <div class="brand">
        <img class="logo" src="${LOGO}" alt="WiTracEQUIP">
        <div>
          WiTracEQUIP
          <div class="by">by WiDIAG MQ</div>
        </div>
      </div>
      <div class="topbar-spacer"></div>
      <div class="org-pill">${esc(state.orgName || '…')}</div>
      <div class="user-menu">
        <button class="user-btn" data-action="toggle-menu">
          <span class="avatar">${initials(state.profile?.full_name || state.session.user.email)}</span>
        </button>
        <div class="dropdown" id="user-dropdown">
          <div class="small muted" style="padding:8px 10px;">
            ${esc(state.session.user.email)}
            <div style="margin-top:4px;">
              <span class="badge badge-role">${esc(libelleRoleCourant())}</span>
            </div>
          </div>
          <button data-action="logout">Se déconnecter</button>
        </div>
      </div>
    </div>

    ${renderBandeauReseau()}

    <div class="tabs">
      <div class="tab ${r.name === 'dashboard' ? 'active' : ''}" data-action="go" data-path="/">Équipements</div>
      <div class="tab ${r.name === 'types' ? 'active' : ''}" data-action="go" data-path="/types">Types d'équipement</div>
      ${isAdmin() ? `<div class="tab ${r.name === 'equipe' ? 'active' : ''}" data-action="go" data-path="/equipe">Équipe</div>` : ''}
    </div>
    <main>${content}</main>
  `;
}

function libelleRoleCourant() {
  const labels = { admin: 'Administrateur', responsable: 'Responsable', utilisateur: 'Utilisateur' };
  return labels[state.profile?.role] || state.profile?.role || '—';
}

/* -------------------------------------------------------------------------
   TÉMOIN DE STATUT RÉSEAU
   -------------------------------------------------------------------------
   Le bandeau n'apparaît que lorsqu'il a quelque chose à dire. Un indicateur
   « En ligne » affiché en permanence cesse d'être lu au bout de deux jours,
   et ne signale donc plus rien le jour où il passe au rouge.

   Trois situations le font apparaître :
     - hors connexion : il faut le savoir AVANT de saisir, pas après ;
     - des enregistrements attendent d'être envoyés ;
     - une synchronisation vient de réussir (message bref, puis il disparaît).
   ------------------------------------------------------------------------- */
function renderBandeauReseau() {
  if (state.syncEnCours) {
    return `<div class="net-banner syncing">
      <span class="dot"></span> Envoi des enregistrements en attente…
    </div>`;
  }

  if (!state.enLigne) {
    return `<div class="net-banner offline">
      <span class="dot"></span>
      Hors connexion — les fiches déjà consultées restent accessibles.
      ${state.outboxCount ? `<span class="spacer"></span>
        <span>${state.outboxCount} enregistrement${state.outboxCount > 1 ? 's' : ''} en attente d'envoi</span>` : ''}
    </div>`;
  }

  if (state.outboxCount > 0) {
    return `<div class="net-banner pending">
      <span class="dot"></span>
      ${state.outboxCount} enregistrement${state.outboxCount > 1 ? 's' : ''} en attente d'envoi.
      <span class="spacer"></span>
      <button class="btn btn-sm" data-action="synchroniser">Envoyer maintenant</button>
    </div>`;
  }

  if (state.syncMessage) {
    return `<div class="net-banner syncing">
      <span class="dot"></span> ${esc(state.syncMessage)}
    </div>`;
  }

  return '';
}

/* =========================================================================
   ÉVÉNEMENTS — CLIC
   ========================================================================= */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;

  switch (action) {
    case 'go': nav(t.dataset.path); fermerMenus(); break;
    case 'toggle-menu':
      e.stopPropagation();
      document.getElementById('user-dropdown')?.classList.toggle('open');
      break;
    case 'logout': logout(); break;
    case 'synchroniser': synchroniser(); break;

    /* Types d'équipement */
    case 'toggle-type-form': basculerTypeForm(); break;
    case 'edit-type': editerType(t.dataset.id); break;
    case 'champ-add': typeFormInput.ajouterChamp(); break;
    case 'champ-remove': typeFormInput.retirerChamp(+t.dataset.i); break;
    case 'save-type': saveType(); break;
    case 'toggle-modeles': typeFormInput.basculerModeles(); break;
    case 'appliquer-modele': appliquerModele(t.dataset.cle); break;

    /* Équipements */
    case 'save-equip': saveEquip(); break;
    case 'toggle-iv-form':
      equipDetail.showIvForm = !equipDetail.showIvForm;
      equipDetail.ivError = '';
      demanderRendu();
      break;
    case 'toggle-edit-equip':
      equipDetail.showEditForm = !equipDetail.showEditForm;
      equipDetail.editError = '';
      demanderRendu();
      break;
    case 'toggle-retrait-form':
      equipDetail.showRetraitForm = !equipDetail.showRetraitForm;
      equipDetail.retraitError = '';
      demanderRendu();
      break;
    case 'restore-equip': remettreEnService(); break;
    case 'print-qr': imprimerEtiquette(); break;

    /* Équipe */
    case 'creer-invite': actionCreerInvite(); break;
    case 'annuler-invite': actionAnnulerInvite(t.dataset.id); break;
    case 'member-active': actionActiverMembre(t.dataset.id, t.dataset.active === '1'); break;
    case 'member-supprimer': actionSupprimerMembre(t.dataset.id, t.dataset.nom); break;
    case 'copier-lien': copierLienInvitation(t.dataset.token, t); break;

    /* Aperçu du mot de passe.
       Manipulation directe du DOM, surtout pas de render() : le rendu
       recréerait le champ et effacerait ce que la personne vient de taper. */
    case 'toggle-pw': {
      const input = t.parentElement && t.parentElement.querySelector('input');
      if (input) {
        const etaitVisible = input.type === 'text';
        input.type = etaitVisible ? 'password' : 'text';
        t.innerHTML = etaitVisible ? ICONE_OEIL : ICONE_OEIL_BARRE;
        const libelle = etaitVisible ? 'Afficher le mot de passe' : 'Masquer le mot de passe';
        t.setAttribute('aria-label', libelle);
        t.setAttribute('title', libelle);
        input.focus();
      }
      break;
    }
  }
});

/* Fermeture du menu utilisateur au clic ailleurs. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) fermerMenus();
});

function fermerMenus() {
  document.getElementById('user-dropdown')?.classList.remove('open');
}

/* =========================================================================
   ÉVÉNEMENTS — SAISIE
   -------------------------------------------------------------------------
   Rappel : appeler demanderRendu() ici efface la saisie en cours. On ne le
   fait que lorsque le changement doit reconfigurer l'écran (choix d'un type,
   coche d'une option), jamais pendant la frappe d'un texte.
   ========================================================================= */

document.addEventListener('input', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;

  switch (action) {
    /* Tableau de bord */
    case 'dash-search': dashboardCache.search = t.value; debounce(refreshDashboard); break;
    case 'dash-filter-type': dashboardCache.typeId = t.value; refreshDashboard(); break;
    case 'dash-archived': dashboardCache.showArchived = t.checked; refreshDashboard(); break;

    /* Types */
    case 'type-nom': typeFormInput.nom(t.value); break;
    case 'champ-label': typeFormInput.champLabel(+t.dataset.i, t.value); break;
    case 'champ-type': typeFormInput.champType(+t.dataset.i, t.value); break;

    /* Création d'équipement */
    case 'equip-type': equipFormInput.type(t.value); break;
    case 'equip-nom': equipFormInput.nom(t.value); break;
    case 'equip-serial': equipFormInput.serial(t.value); break;
    case 'equip-valeur': equipFormInput.valeur(t.dataset.key, t.value); break;

    /* Retrait du parc */
    case 'retrait-motif':
      equipDetail.retraitMotif = t.value;
      equipDetail.retraitError = '';
      demanderRendu(); // fait apparaître ou disparaître le champ « Autre »
      break;
    case 'retrait-motif-autre': equipDetail.retraitMotifAutre = t.value; break;
    case 'retrait-operateur': equipDetail.retraitOperateur = t.value; break;

    /* Équipe */
    case 'invite-role': inviteInput.role(t.value); break;
    case 'invite-label': inviteInput.label(t.value); break;
    case 'invite-tous-types': inviteInput.tousTypes(t.checked); break;
    case 'invite-type': inviteInput.type(t.dataset.type, t.checked); break;
    case 'member-role': actionRoleMembre(t.dataset.id, t.value); break;
    case 'acces-tous': actionAccesTous(t.dataset.id, t.checked); break;
    case 'acces-type': actionAccesType(t.dataset.id, t.dataset.type, t.checked); break;
  }
});

/* =========================================================================
   ÉVÉNEMENTS — SOUMISSION DE FORMULAIRE
   ========================================================================= */

document.addEventListener('submit', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  e.preventDefault();

  switch (t.dataset.action) {
    case 'submit-auth': handleAuthSubmit(t); break;
    case 'submit-join': handleJoinSubmit(t); break;
    case 'submit-iv': submitIntervention(t); break;
    case 'submit-edit-equip': submitEditEquip(t); break;
    case 'submit-retrait': soumettreRetrait(); break;
  }
});

/* =========================================================================
   DÉMARRAGE
   ========================================================================= */

setRenderer(render);

initRouting(() => {
  // Ouvrir une fiche force son rechargement, quelle que soit la façon d'y
  // arriver (clic, scan d'un QR code, retour arrière, lien collé) : plusieurs
  // personnes travaillent sur la même base, les données en cache peuvent être
  // périmées. Sur un carnet d'entretien, afficher une version obsolète sans
  // le dire serait pire que d'afficher une erreur.
  if (state.route.name === 'equip') invaliderFiche();
  if (state.route.name === 'equip-new') resetEquipForm();
  demanderRendu();
});

initOffline();

initAuth(() => {
  // Remise à zéro des caches de vue à la déconnexion : les données d'un
  // compte ne doivent pas rester à l'écran au moment où le suivant se
  // connecte sur le même appareil.
  resetDashboardCache();
  resetEquipeCache();
  resetTypesState();
  resetEquipForm();
});

/* Enregistrement du Service Worker : c'est lui qui rend l'application
   installable et utilisable sans réseau. Son absence (navigateur ancien,
   page servie en file://) ne doit jamais empêcher l'application de
   fonctionner normalement en ligne. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => {
      console.warn("Service Worker non enregistré — le mode hors ligne sera limité.", e);
    });
  });
}

render(); // premier rendu (spinner) pendant que la session se charge
