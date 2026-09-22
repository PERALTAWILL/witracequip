/* =========================================================================
   WiTracEQUIP — équipements
   -------------------------------------------------------------------------
   Trois écrans : la liste, la création, la fiche.
   Deux règles métier y sont appliquées, absentes de la version monolithique
   précédente alors que la base de données les attendait déjà :

     1. DÉTECTION DE DOUBLON à la création, sur le numéro de série et lui
        seul, en avertissement et jamais en blocage.
     2. RETRAIT TRAÇABLE : motif et opérateur obligatoires, fiche conservée.

   Chacune est documentée au-dessus de son implémentation, avec la raison
   métier qui la justifie.
   ========================================================================= */

import { state, render, peutSupprimer, isAdmin } from '../core/store.js';
import { esc, attr, fmtDate, fmtDateTime, initials, debounce } from '../core/dom.js';
import { MOTIFS_RETRAIT } from '../config.js';
import {
  listEquipements, getEquipement, listInterventions,
  chercherDoublonsSerie, creerEquipement, modifierEquipement,
  archiverEquipement, restaurerEquipement,
} from '../services/supabase.js';
import {
  mettreEnCacheFiche, lireFicheEnCache, mettreEnCacheListe, lireListeEnCache,
  interventionsEnAttente,
} from '../services/offline.js';
import { nav, lienEquipement, adresseDefinitive } from './routing.js';
import { drawQr, printQr } from './qrcode.js';
import { renderIvForm, soumettreIntervention, renderHistorique } from './interventions.js';

/* =========================================================================
   ÉCRAN 1 — LISTE DES ÉQUIPEMENTS
   ========================================================================= */

export let dashboardCache = {
  items: null, search: '', typeId: '', showArchived: false,
  loading: false, error: '', depuisCache: false,
};

export function resetDashboardCache() {
  dashboardCache = {
    items: null, search: '', typeId: '', showArchived: false,
    loading: false, error: '', depuisCache: false,
  };
}

export function refreshDashboard() {
  dashboardCache.items = null;
  dashboardCache.error = '';
  dashboardCache.depuisCache = false;
  render();
}

export function viewDashboard() {
  if (dashboardCache.items === null && !dashboardCache.loading) {
    dashboardCache.loading = true;
    listEquipements({
      search: dashboardCache.search,
      typeId: dashboardCache.typeId,
      showArchived: dashboardCache.showArchived,
    })
      .then((items) => {
        dashboardCache.items = items;
        dashboardCache.loading = false;
        dashboardCache.depuisCache = false;
        // La liste sans filtre est celle qui servira hors ligne.
        if (!dashboardCache.search && !dashboardCache.typeId && !dashboardCache.showArchived) {
          mettreEnCacheListe(items);
        }
        render();
      })
      .catch((e) => {
        // Hors ligne : on montre la dernière liste connue plutôt qu'une erreur.
        const cache = lireListeEnCache();
        if (cache) {
          dashboardCache.items = cache.items;
          dashboardCache.depuisCache = true;
          state.enLigne = false;
        } else {
          dashboardCache.error = e.message;
        }
        dashboardCache.loading = false;
        render();
      });
  }

  const typeOptions = state.types.map((t) => `
    <option value="${attr(t.id)}" ${dashboardCache.typeId === t.id ? 'selected' : ''}>${esc(t.nom)}</option>
  `).join('');

  let list = '';
  if (dashboardCache.error) {
    list = `<div class="alert alert-error">${esc(dashboardCache.error)}</div>`;
  } else if (dashboardCache.items === null) {
    list = `<div class="spinner"></div>`;
  } else if (dashboardCache.items.length === 0) {
    list = `<div class="empty"><div class="big">🔧</div>Aucun équipement pour l'instant.<br>
            <span class="small">Ajoutez votre premier équipement pour générer son QR code.</span></div>`;
  } else {
    list = `<div class="card" style="padding:0 18px;">` + dashboardCache.items.map((eq) => {
      const t = state.types.find((x) => x.id === eq.type_id);
      return `
        <div class="list-item" style="cursor:pointer;" data-action="go" data-path="/equip/${attr(eq.id)}">
          <div class="thumb">${initials(eq.nom)}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:650;">
              ${esc(eq.nom)} ${eq.archived ? '<span class="badge badge-warn">retiré</span>' : ''}
            </div>
            <div class="small muted">
              ${esc(t?.nom || 'Type inconnu')}${eq.serial_value ? ' · N/S ' + esc(eq.serial_value) : ''}
            </div>
          </div>
          <div class="small muted">${fmtDate(eq.created_at)}</div>
        </div>`;
    }).join('') + `</div>`;
  }

  return `
    <div class="row between wrap" style="margin-bottom:14px;">
      <h2>Équipements</h2>
      ${state.typesLoaded && state.types.length
        ? `<button class="btn btn-primary" data-action="go" data-path="/equip-new">+ Nouvel équipement</button>`
        : `<button class="btn btn-primary" data-action="go" data-path="/types">Créer un type d'équipement d'abord</button>`}
    </div>

    ${dashboardCache.depuisCache ? `
      <div class="cache-note">
        Liste enregistrée sur cet appareil${lireListeEnCache()?.enregistreLe
          ? ', mise à jour le ' + fmtDateTime(lireListeEnCache().enregistreLe) : ''}.
        Elle sera actualisée au retour du réseau.
      </div>` : ''}

    <div class="card" style="margin-bottom:14px;">
      <div class="row wrap" style="gap:10px;">
        <input type="search" placeholder="Rechercher par nom…" style="flex:2;min-width:160px;"
               value="${attr(dashboardCache.search)}" data-action="dash-search">
        <select style="flex:1;min-width:140px;" data-action="dash-filter-type">
          <option value="">Tous les types</option>
          ${typeOptions}
        </select>
        <label style="display:flex;align-items:center;gap:6px;text-transform:none;font-weight:500;font-size:13.5px;color:var(--text);margin:0;">
          <input type="checkbox" style="width:auto;" ${dashboardCache.showArchived ? 'checked' : ''} data-action="dash-archived">
          Voir les retirés
        </label>
      </div>
    </div>

    ${list}
  `;
}

/* =========================================================================
   ÉCRAN 2 — CRÉATION D'UN ÉQUIPEMENT
   ========================================================================= */

let equipForm = {
  typeId: '', nom: '', serial_value: '', valeurs: {},
  busy: false, error: '',
  doublons: [],          // équipements existants portant le même n° de série
  doublonsVus: false,    // l'avertissement a déjà été présenté une fois
  verifEnCours: false,
};

export function resetEquipForm() {
  equipForm = {
    typeId: '', nom: '', serial_value: '', valeurs: {},
    busy: false, error: '', doublons: [], doublonsVus: false, verifEnCours: false,
  };
}

/* -------------------------------------------------------------------------
   RÈGLE MÉTIER 1 — DÉTECTION DE DOUBLON
   -------------------------------------------------------------------------
   Sur le NUMÉRO DE SÉRIE uniquement, jamais sur le nom : deux véhicules
   peuvent légitimement s'appeler « Kangoo atelier », deux appareils du même
   fabricant ne portent pas le même numéro de série.

   AVERTISSEMENT, jamais blocage. Le cas qui tranche : un technicien reprend
   l'inventaire d'un parc existant et saisit un appareil dont un collègue a
   déjà créé la fiche la semaine dernière. Le bloquer l'oblige à interrompre
   sa tournée pour appeler quelqu'un. L'avertir, en lui montrant la fiche en
   cause, lui permet de trancher en trois secondes : soit c'est bien le même
   appareil et il ouvre la fiche existante, soit c'est un homonyme de numéro
   entre deux fabricants et il continue.

   La vérification a lieu deux fois : pendant la frappe (retour immédiat) et
   juste avant l'enregistrement (au cas où la saisie aurait été collée d'un
   coup, ou un doublon créé entre-temps par un collègue).
   ------------------------------------------------------------------------- */

/** Vérification pendant la frappe, à l'écart du chemin d'enregistrement. */
function verifierDoublonEnDirect() {
  const valeur = equipForm.serial_value.trim();
  if (!valeur) {
    equipForm.doublons = [];
    equipForm.doublonsVus = false;
    render();
    return;
  }
  if (!state.enLigne) return; // hors ligne, on ne peut pas savoir : on se tait

  equipForm.verifEnCours = true;
  chercherDoublonsSerie(valeur)
    .then((trouves) => {
      // La réponse peut arriver après que la personne a continué à taper.
      if (equipForm.serial_value.trim() !== valeur) return;
      equipForm.doublons = trouves;
      equipForm.verifEnCours = false;
      render();
    })
    .catch(() => {
      // Un échec de vérification ne doit jamais empêcher la saisie : c'est un
      // confort, pas une garantie. Le silence est le bon comportement ici.
      equipForm.verifEnCours = false;
      equipForm.doublons = [];
      render();
    });
}

/** Encadré d'avertissement, avec un lien direct vers chaque fiche en cause. */
function renderAvertissementDoublon() {
  if (!equipForm.doublons.length) return '';

  const liens = equipForm.doublons.map((d) => {
    const t = state.types.find((x) => x.id === d.type_id);
    return `<a href="#/equip/${attr(d.id)}">
              ${esc(d.nom)}${t ? ' — ' + esc(t.nom) : ''}${d.archived ? ' (retiré du parc)' : ''}
            </a>`;
  }).join('');

  const pluriel = equipForm.doublons.length > 1;

  return `
    <div class="alert alert-doublon">
      <strong>
        ${pluriel
          ? `${equipForm.doublons.length} équipements portent déjà ce numéro de série.`
          : 'Un équipement porte déjà ce numéro de série.'}
      </strong>
      Vérifiez qu'il ne s'agit pas du même appareil avant de créer une seconde fiche.
      Si c'est bien un équipement distinct, vous pouvez continuer : l'enregistrement
      n'est pas bloqué.
      <div class="liens">${liens}</div>
    </div>
  `;
}

export function viewEquipNew() {
  if (!equipForm.typeId && state.types.length) equipForm.typeId = state.types[0].id;
  const type = state.types.find((t) => t.id === equipForm.typeId);
  const champs = type?.champs || [];

  // Un doublon déjà présenté transforme le bouton : la personne confirme
  // explicitement son choix au lieu de recliquer sans avoir lu.
  const doitConfirmer = equipForm.doublons.length > 0 && equipForm.doublonsVus;

  return `
    <div class="row" style="margin-bottom:14px;gap:10px;">
      <button class="icon-btn" data-action="go" data-path="/" title="Retour">←</button>
      <h2>Nouvel équipement</h2>
    </div>
    <div class="card">
      ${equipForm.error ? `<div class="alert alert-error">${esc(equipForm.error)}</div>` : ''}
      ${!state.enLigne ? `
        <div class="alert alert-info">
          Hors connexion : la création d'un équipement nécessite le réseau, car
          sa fiche doit recevoir un identifiant définitif avant de pouvoir être
          associée à un QR code imprimé.
        </div>` : ''}

      <div class="grid-2">
        <div class="field">
          <label>Type d'équipement</label>
          <select data-action="equip-type">
            ${state.types.map((t) => `
              <option value="${attr(t.id)}" ${t.id === equipForm.typeId ? 'selected' : ''}>${esc(t.nom)}</option>
            `).join('')}
          </select>
        </div>
        <div class="field">
          <label>Nom / désignation</label>
          <input type="text" placeholder="Ex : Renault Kangoo — WD-12"
                 value="${attr(equipForm.nom)}" data-action="equip-nom">
        </div>
      </div>

      <div class="field">
        <label>N° de série / immatriculation (optionnel)</label>
        <input type="text" placeholder="Ex : AB-123-CD"
               value="${attr(equipForm.serial_value)}" data-action="equip-serial">
        <div class="hint">
          C'est ce numéro qui identifie physiquement l'appareil et qui sera imprimé
          sous le QR code. L'application signale si un autre équipement porte déjà
          le même — sans jamais vous empêcher d'enregistrer.
        </div>
      </div>

      ${renderAvertissementDoublon()}

      ${champs.length ? `<label style="margin-top:6px;">Informations spécifiques au type</label>` : ''}
      <div class="grid-2">
        ${champs.map((c) => `
          <div class="field">
            <label style="text-transform:none;font-weight:600;color:var(--text);">${esc(c.label)}</label>
            ${c.type === 'textarea'
              ? `<textarea data-action="equip-valeur" data-key="${attr(c.key)}">${esc(equipForm.valeurs[c.key] || '')}</textarea>`
              : `<input type="${attr(typeHtml(c.type))}" value="${attr(equipForm.valeurs[c.key] || '')}"
                        data-action="equip-valeur" data-key="${attr(c.key)}">`}
          </div>
        `).join('')}
      </div>

      <div class="row wrap" style="margin-top:8px;">
        <button class="btn ${doitConfirmer ? '' : 'btn-primary'}" data-action="save-equip" ${equipForm.busy ? 'disabled' : ''}>
          ${equipForm.busy
            ? 'Enregistrement…'
            : (doitConfirmer ? 'Créer quand même cet équipement' : "Créer l'équipement")}
        </button>
        <button class="btn" data-action="go" data-path="/">Annuler</button>
      </div>
    </div>
  `;
}

/** Traduit un type de champ métier en type d'input HTML. */
function typeHtml(t) {
  if (t === 'number') return 'number';
  if (t === 'date') return 'date';
  return 'text';
}

export async function saveEquip() {
  equipForm.error = '';

  const nom = equipForm.nom.trim();
  if (!nom) { equipForm.error = 'Le nom est obligatoire.'; render(); return; }
  if (!equipForm.typeId) { equipForm.error = "Choisissez un type d'équipement."; render(); return; }

  const serial = equipForm.serial_value.trim();

  // Dernière vérification avant écriture : un collègue a pu créer la même
  // fiche pendant la saisie. Si un doublon apparaît et n'a pas encore été
  // montré, on s'arrête une fois — une seule — pour le présenter.
  if (serial && !equipForm.doublonsVus && state.enLigne) {
    equipForm.busy = true; render();
    try {
      const trouves = await chercherDoublonsSerie(serial);
      if (trouves.length) {
        equipForm.doublons = trouves;
        equipForm.doublonsVus = true;
        equipForm.busy = false;
        render();
        return; // on n'écrit pas encore : la personne doit voir l'avertissement
      }
    } catch (e) {
      // Vérification impossible : ce n'est pas une raison de refuser la saisie.
    }
    equipForm.busy = false;
  }

  equipForm.busy = true; render();
  try {
    const cree = await creerEquipement({
      organizationId: state.profile.organization_id,
      typeId: equipForm.typeId,
      nom,
      serial,
      valeurs: equipForm.valeurs,
    });
    resetEquipForm();
    refreshDashboard();
    nav('/equip/' + cree.id);
  } catch (e) {
    equipForm.busy = false;
    equipForm.error = e.message;
    render();
  }
}

/* Saisie du formulaire de création — appelé par la délégation d'événements. */
export const equipFormInput = {
  type(v) { equipForm.typeId = v; render(); },
  nom(v) { equipForm.nom = v; },
  serial(v) {
    equipForm.serial_value = v;
    // Toute modification du numéro annule la confirmation déjà donnée :
    // l'avertissement porte sur un numéro précis, pas sur le formulaire.
    equipForm.doublonsVus = false;
    debounce(verifierDoublonEnDirect, 450);
  },
  valeur(key, v) { equipForm.valeurs[key] = v; },
};

/* =========================================================================
   ÉCRAN 3 — FICHE D'UN ÉQUIPEMENT
   ========================================================================= */

export let equipDetail = etatFicheVide(null);

function etatFicheVide(id) {
  return {
    id, item: null, interventions: null, loading: false, error: '',
    depuisCache: false,
    showIvForm: false, ivBusy: false, ivError: '',
    showEditForm: false, editBusy: false, editError: '',
    showRetraitForm: false, retraitBusy: false, retraitError: '',
    retraitMotif: '', retraitMotifAutre: '', retraitOperateur: '',
  };
}

/** Force le rechargement de la fiche au prochain rendu. */
export function invaliderFiche() {
  equipDetail.id = null;
}

export function viewEquipDetail(id) {
  if (equipDetail.id !== id) {
    equipDetail = etatFicheVide(id);
    equipDetail.loading = true;
    chargerFiche(id);
    return `<div class="spinner"></div>`;
  }

  if (equipDetail.loading) return `<div class="spinner"></div>`;
  if (equipDetail.error) return `<div class="alert alert-error">${esc(equipDetail.error)}</div>`;
  if (!equipDetail.item) return `<div class="empty">Équipement introuvable.</div>`;

  const eq = equipDetail.item;
  const type = state.types.find((t) => t.id === eq.type_id);
  const champs = type?.champs || [];
  const url = lienEquipement(eq.id);

  const infoRows = champs.map((c) => {
    const brut = eq.valeurs?.[c.key];
    const val = !brut ? '—' : (c.type === 'date' ? fmtDate(brut) : esc(brut));
    return `<tr><td class="muted">${esc(c.label)}</td><td>${val}</td></tr>`;
  }).join('');

  // Le QR est dessiné dans un <canvas> que chaque réaffichage recrée vide.
  // On le redessine donc après CHAQUE rendu de la fiche, sinon ouvrir un
  // formulaire efface le QR — et l'étiquette sortirait vierge.
  setTimeout(() => drawQr(eq.id), 0);

  return `
    <div class="fiche-entete">
      <button class="icon-btn" data-action="go" data-path="/" title="Retour">←</button>
      <div class="titre">
        <h2>${esc(eq.nom)} ${eq.archived ? '<span class="badge badge-warn">retiré du parc</span>' : ''}</h2>
        <div class="small muted">
          ${esc(type?.nom || '')}${eq.serial_value ? ' · N/S ' + esc(eq.serial_value) : ''}
        </div>
      </div>
      <div class="actions">
        ${!eq.archived ? `<button class="btn btn-sm" data-action="toggle-edit-equip">${equipDetail.showEditForm ? 'Annuler' : 'Modifier'}</button>` : ''}
        ${!eq.archived && peutSupprimer() ? `<button class="btn btn-danger btn-sm" data-action="toggle-retrait-form">Retirer du parc</button>` : ''}
        ${eq.archived && peutSupprimer() ? `<button class="btn btn-sm" data-action="restore-equip">Remettre en service</button>` : ''}
      </div>
    </div>

    ${equipDetail.depuisCache ? `
      <div class="cache-note">
        Fiche enregistrée sur cet appareil${equipDetail.enregistreLe ? ', consultée le ' + fmtDateTime(equipDetail.enregistreLe) : ''}.
        Les données affichées peuvent avoir changé depuis.
      </div>` : ''}

    ${eq.archived ? renderBandeauRetrait(eq) : ''}
    ${equipDetail.showRetraitForm && !eq.archived ? renderRetraitForm() : ''}
    ${equipDetail.showEditForm && !eq.archived ? renderEditEquipForm(eq, champs) : ''}

    <div class="grid-2" style="align-items:start;">
      <div class="card">
        <h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">QR code</h3>
        <div class="qr-box">
          <canvas id="qr-canvas"></canvas>
          <div class="small muted" style="word-break:break-all;text-align:center;">${esc(url)}</div>
          ${(!adresseDefinitive() && isAdmin()) ? `
            <div class="alert alert-info small" style="margin:0;">
              Adresse provisoire : ce QR code pointe vers l'adresse actuelle de l'application.
              Ne pas imprimer d'étiquettes en série avant que le domaine définitif soit en place.
            </div>` : ''}
          <button class="btn btn-primary btn-block" data-action="print-qr">🖨️ Imprimer l'étiquette</button>
        </div>
      </div>

      <div class="card">
        <h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">Informations</h3>
        <table>
          <tr><td class="muted">Créé le</td><td>${fmtDateTime(eq.created_at)}</td></tr>
          ${infoRows}
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="row between">
        <h3>Historique des interventions</h3>
        <button class="btn btn-sm" data-action="toggle-iv-form">${equipDetail.showIvForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>

      ${equipDetail.showIvForm ? renderIvForm({ busy: equipDetail.ivBusy, error: equipDetail.ivError }) : ''}

      ${renderHistorique(interventionsAffichables())}
    </div>
  `;
}

/**
 * Historique affiché = ce que la base connaît + ce qui attend d'être envoyé.
 * Les deux sont mêlés puis triés par date décroissante, pour qu'une
 * intervention saisie hors ligne apparaisse à sa vraie place chronologique
 * et non reléguée en bas de tableau.
 */
function interventionsAffichables() {
  const enBase = equipDetail.interventions || [];
  const enFile = interventionsEnAttente(equipDetail.id);
  const idsEnBase = new Set(enBase.map((i) => i.id));
  const fusion = [...enFile.filter((i) => !idsEnBase.has(i.id)), ...enBase];
  return fusion.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function chargerFiche(id) {
  try {
    const [item, ivs] = await Promise.all([getEquipement(id), listInterventions(id)]);
    if (equipDetail.id !== id) return; // la personne a déjà navigué ailleurs
    equipDetail.item = item;
    equipDetail.interventions = ivs;
    equipDetail.loading = false;
    equipDetail.depuisCache = false;
    if (item) mettreEnCacheFiche(id, item, ivs);
    render();
    setTimeout(() => drawQr(id), 30);
  } catch (e) {
    if (equipDetail.id !== id) return;
    // Hors ligne : si la fiche a déjà été consultée, on la ressort du cache.
    // C'est le cœur de la promesse : scanner un QR dans un sous-sol et voir
    // quand même le carnet d'entretien de l'appareil.
    const cache = lireFicheEnCache(id);
    if (cache) {
      equipDetail.item = cache.equipement;
      equipDetail.interventions = cache.interventions;
      equipDetail.depuisCache = true;
      equipDetail.enregistreLe = cache.enregistreLe;
      state.enLigne = false;
    } else {
      equipDetail.error = state.enLigne
        ? e.message
        : "Cette fiche n'a jamais été ouverte sur cet appareil : elle ne peut pas être consultée hors connexion.";
    }
    equipDetail.loading = false;
    render();
  }
}

/* -------------------------------------------------------------------------
   RÈGLE MÉTIER 2 — RETRAIT TRAÇABLE
   -------------------------------------------------------------------------
   Un équipement n'est jamais supprimé : il est retiré du parc. Sa fiche et
   tout son historique restent consultables, sinon le carnet d'entretien
   perdrait ses pages au moment précis où l'on pourrait avoir à s'en servir —
   un litige sur un appareil revendu, un contrôle portant sur une période
   passée, une expertise après sinistre.

   Deux informations sont exigées, et le mot « exigées » est à prendre au
   pied de la lettre : le formulaire refuse, la fonction de service refuse, et
   la contrainte SQL ajoutée par sql/04-tracabilite-retrait.sql refuse aussi.
     - le MOTIF : pourquoi l'appareil sort du parc ;
     - l'OPÉRATEUR : qui en a décidé.
   Un retrait anonyme et sans raison, c'est une disparition. Ce que la
   réglementation demande, c'est une sortie documentée.

   Le champ opérateur est pré-rempli avec le nom du profil connecté mais reste
   modifiable : un responsable saisit parfois la décision d'un tiers, et c'est
   le nom du décideur qui doit figurer au carnet.
   ------------------------------------------------------------------------- */

function renderBandeauRetrait(eq) {
  return `
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--warn);">
      <h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">
        Retrait du parc
      </h3>
      <table>
        <tr><td class="muted" style="width:40%;">Motif</td><td>${esc(eq.archive_reason || '— non renseigné —')}</td></tr>
        <tr><td class="muted">Retiré par</td><td>${esc(eq.archived_by || '— non renseigné —')}</td></tr>
        <tr><td class="muted">Date du retrait</td><td>${fmtDateTime(eq.archived_at)}</td></tr>
      </table>
      <div class="hint">
        La fiche et son historique sont conservés : le retrait documente une sortie
        du parc, il n'efface rien.
      </div>
    </div>
  `;
}

function renderRetraitForm() {
  const options = MOTIFS_RETRAIT.map((m) => `
    <option value="${attr(m)}" ${equipDetail.retraitMotif === m ? 'selected' : ''}>${esc(m)}</option>
  `).join('');

  const motifLibre = equipDetail.retraitMotif === 'Autre';

  return `
    <form class="card" style="margin-bottom:14px;border-left:3px solid var(--danger);" data-action="submit-retrait">
      <h3>Retirer cet équipement du parc</h3>
      <div class="hint" style="margin-bottom:12px;">
        L'équipement disparaîtra de la liste active, mais sa fiche et son historique
        d'interventions restent consultables via « Voir les retirés ». Le motif et
        votre nom seront inscrits au carnet.
      </div>
      ${equipDetail.retraitError ? `<div class="alert alert-error">${esc(equipDetail.retraitError)}</div>` : ''}

      <div class="field">
        <label>Motif du retrait <span class="oblig">obligatoire</span></label>
        <select name="motif" data-action="retrait-motif" required>
          <option value="">— Choisir un motif —</option>
          ${options}
        </select>
      </div>

      ${motifLibre ? `
        <div class="field">
          <label>Précisez le motif <span class="oblig">obligatoire</span></label>
          <input type="text" name="motif_autre" value="${attr(equipDetail.retraitMotifAutre)}"
                 data-action="retrait-motif-autre" placeholder="Ex : transféré au site de Ducos">
        </div>` : ''}

      <div class="field">
        <label>Retiré par <span class="oblig">obligatoire</span></label>
        <input type="text" name="operateur"
               value="${attr(equipDetail.retraitOperateur || state.profile?.full_name || '')}"
               data-action="retrait-operateur" placeholder="Nom de la personne qui décide du retrait">
        <div class="hint">
          Pré-rempli avec votre nom. À modifier si vous enregistrez la décision
          d'un collègue : c'est son nom qui doit figurer au carnet.
        </div>
      </div>

      <div class="row wrap">
        <button class="btn btn-danger" type="submit" ${equipDetail.retraitBusy ? 'disabled' : ''}>
          ${equipDetail.retraitBusy ? 'Retrait en cours…' : 'Confirmer le retrait'}
        </button>
        <button class="btn" type="button" data-action="toggle-retrait-form">Annuler</button>
      </div>
    </form>
  `;
}

export async function soumettreRetrait() {
  const motif = equipDetail.retraitMotif === 'Autre'
    ? equipDetail.retraitMotifAutre.trim()
    : equipDetail.retraitMotif.trim();
  const operateur = (equipDetail.retraitOperateur || state.profile?.full_name || '').trim();

  if (!motif) {
    equipDetail.retraitError = equipDetail.retraitMotif === 'Autre'
      ? "Précisez le motif du retrait."
      : "Le motif du retrait est obligatoire : c'est lui qui documente la sortie du parc.";
    render(); return;
  }
  if (!operateur) {
    equipDetail.retraitError = "Le nom de la personne qui retire l'équipement est obligatoire.";
    render(); return;
  }

  equipDetail.retraitError = '';
  equipDetail.retraitBusy = true;
  render();

  try {
    await archiverEquipement(equipDetail.id, { motif, operateur });
    equipDetail.item = await getEquipement(equipDetail.id);
    equipDetail.showRetraitForm = false;
    equipDetail.retraitMotif = '';
    equipDetail.retraitMotifAutre = '';
    mettreEnCacheFiche(equipDetail.id, equipDetail.item, equipDetail.interventions);
    dashboardCache.items = null;
  } catch (e) {
    equipDetail.retraitError = e.message;
  } finally {
    equipDetail.retraitBusy = false;
    render();
  }
}

export async function remettreEnService() {
  if (!confirm("Remettre cet équipement en service ? Il réapparaîtra dans la liste active, et le motif de son retrait sera effacé.")) return;
  try {
    await restaurerEquipement(equipDetail.id);
    equipDetail.item = await getEquipement(equipDetail.id);
    mettreEnCacheFiche(equipDetail.id, equipDetail.item, equipDetail.interventions);
    dashboardCache.items = null;
    render();
  } catch (e) {
    alert('Erreur : ' + e.message);
  }
}

/* =========================================================================
   MODIFICATION D'UNE FICHE
   ========================================================================= */

function renderEditEquipForm(eq, champs) {
  return `
    <form class="card" style="margin-bottom:14px;" data-action="submit-edit-equip">
      <h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">Modifier la fiche</h3>
      ${equipDetail.editError ? `<div class="alert alert-error">${esc(equipDetail.editError)}</div>` : ''}
      <div class="grid-2">
        <div class="field">
          <label>Nom / désignation</label>
          <input type="text" name="nom" value="${attr(eq.nom || '')}" required>
        </div>
        <div class="field">
          <label>N° de série / immatriculation</label>
          <input type="text" name="serial_value" value="${attr(eq.serial_value || '')}">
        </div>
      </div>
      ${champs.length ? `<label style="margin-top:6px;">Informations spécifiques au type</label>` : ''}
      <div class="grid-2">
        ${champs.map((c) => {
          const val = eq.valeurs?.[c.key] ?? '';
          return `
          <div class="field">
            <label style="text-transform:none;font-weight:600;color:var(--text);">${esc(c.label)}</label>
            ${c.type === 'textarea'
              ? `<textarea name="champ__${attr(c.key)}">${esc(val)}</textarea>`
              : `<input type="${attr(typeHtml(c.type))}" name="champ__${attr(c.key)}" value="${attr(val)}">`}
          </div>`;
        }).join('')}
      </div>
      <div class="row wrap" style="margin-top:8px;">
        <button class="btn btn-primary" type="submit" ${equipDetail.editBusy ? 'disabled' : ''}>
          ${equipDetail.editBusy ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
        <button class="btn" type="button" data-action="toggle-edit-equip">Annuler</button>
      </div>
    </form>
  `;
}

export async function submitEditEquip(form) {
  const fd = new FormData(form);
  const nom = String(fd.get('nom') || '').trim();
  if (!nom) { equipDetail.editError = 'Le nom est obligatoire.'; render(); return; }

  const serial = String(fd.get('serial_value') || '').trim();
  const valeurs = Object.assign({}, equipDetail.item?.valeurs || {});
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('champ__')) valeurs[k.slice(7)] = v;
  }

  equipDetail.editError = '';
  equipDetail.editBusy = true;
  render();

  try {
    // Le doublon est signalé ici aussi : corriger un numéro de série peut créer
    // une collision avec une fiche existante tout autant qu'en création.
    if (serial && serial !== String(equipDetail.item?.serial_value || '').trim()) {
      const doublons = await chercherDoublonsSerie(serial, equipDetail.id);
      if (doublons.length && !confirm(
        `Un autre équipement porte déjà le numéro de série « ${serial} » :\n\n`
        + doublons.map((d) => '  • ' + d.nom).join('\n')
        + `\n\nEnregistrer quand même ?`)) {
        equipDetail.editBusy = false;
        render();
        return;
      }
    }

    await modifierEquipement(equipDetail.id, { nom, serial, valeurs });
    equipDetail.item = await getEquipement(equipDetail.id);
    equipDetail.showEditForm = false;
    mettreEnCacheFiche(equipDetail.id, equipDetail.item, equipDetail.interventions);
    dashboardCache.items = null; // la liste sera rechargée au retour
  } catch (e) {
    equipDetail.editError = e.message;
  } finally {
    equipDetail.editBusy = false;
    render();
  }
}

/* =========================================================================
   INTERVENTIONS DEPUIS LA FICHE
   ========================================================================= */

export async function submitIntervention(form) {
  equipDetail.ivError = '';
  equipDetail.ivBusy = true;
  render();

  const res = await soumettreIntervention(form, equipDetail.id);

  if (res.erreur) {
    equipDetail.ivBusy = false;
    equipDetail.ivError = res.erreur;
    render();
    return;
  }

  equipDetail.showIvForm = false;
  if (!res.enAttente) {
    try {
      equipDetail.interventions = await listInterventions(equipDetail.id);
      mettreEnCacheFiche(equipDetail.id, equipDetail.item, equipDetail.interventions);
    } catch (e) { /* la liste en cache reste affichée */ }
  }
  equipDetail.ivBusy = false;
  render();
}

/** Impression de l'étiquette de la fiche ouverte. */
export function imprimerEtiquette() {
  printQr(equipDetail.item);
}
