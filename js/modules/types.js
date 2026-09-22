/* =========================================================================
   WiTracEQUIP — types d'équipement
   -------------------------------------------------------------------------
   Un « type » décrit une famille d'appareils et les champs qu'on veut suivre
   pour elle : un véhicule a un kilométrage et une date de contrôle technique,
   un extincteur a une date de révision décennale. Plutôt que d'imposer un
   modèle de données unique, chaque organisation définit les siens.

   Deux points d'attention, tous deux appris de cas réels :

   LA CLÉ D'UN CHAMP NE CHANGE JAMAIS. Chaque champ a un libellé (affiché) et
   une clé (stockée). Les valeurs saisies sur les équipements sont rangées
   sous la clé. Recalculer la clé lors d'un renommage de libellé détacherait
   silencieusement toutes les valeurs déjà saisies : « Kilométrage » renommé
   en « Km » viderait la colonne sur tout le parc. La clé est donc calculée
   une fois, à la création du champ, et conservée telle quelle ensuite.

   UN MODÈLE MÉTIER COMPLÈTE, IL N'ÉCRASE JAMAIS. Appliquer un modèle sur une
   organisation qui a déjà des types ne touche pas à l'existant : seuls les
   types absents sont ajoutés.
   ========================================================================= */

import { state, render, isAdmin } from '../core/store.js';
import { esc, attr, slugify } from '../core/dom.js';
import { CHAMP_TYPES, MODELES_METIERS } from '../config.js';
import { listTypes, creerType, creerTypes, modifierType } from '../services/supabase.js';
import { mettreEnCacheTypes } from '../services/offline.js';
import { dashboardCache } from './equipements.js';

let typeForm = { open: false, id: null, nom: '', champs: [], busy: false, error: '' };
let modeleState = { ouvert: false, busy: false };

function typeFormVide() {
  return { open: false, id: null, nom: '', champs: [], busy: false, error: '' };
}

export function resetTypesState() {
  typeForm = typeFormVide();
  modeleState = { ouvert: false, busy: false };
}

/* =========================================================================
   VUE
   ========================================================================= */

export function viewTypes() {
  const rows = state.types.map((t) => `
    <div class="list-item">
      <div class="thumb">🏷️</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:650;">${esc(t.nom)}</div>
        <div class="small muted">
          ${(t.champs || []).length} champ(s) personnalisé(s)${(t.champs || []).length
            ? ' · ' + (t.champs || []).map((c) => esc(c.label)).join(', ') : ''}
        </div>
      </div>
      ${isAdmin() ? `<button class="btn btn-sm" data-action="edit-type" data-id="${attr(t.id)}">Modifier</button>` : ''}
    </div>
  `).join('');

  return `
    <div class="row between wrap" style="margin-bottom:14px;">
      <h2>Types d'équipement</h2>
      ${isAdmin()
        ? `<button class="btn btn-primary" data-action="toggle-type-form">${typeForm.open ? 'Annuler' : '+ Nouveau type'}</button>`
        : ''}
    </div>

    ${typeForm.open && isAdmin() ? renderTypeForm() : ''}

    ${(isAdmin() && !typeForm.open) ? renderModeles() : ''}

    <div class="card" style="padding:0 18px;">
      ${state.types.length ? rows : `
        <div class="empty">
          <div class="big">🏷️</div>Aucun type d'équipement.<br>
          <span class="small">${isAdmin()
            ? "Créez-en un (ex. « Véhicule », « Dispositif médical », « Équipement industriel »…) pour commencer à ajouter des équipements."
            : "Aucun type ne vous a été attribué. Contactez votre administrateur."}</span>
        </div>`}
    </div>
  `;
}

function renderModeles() {
  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="row between wrap" style="gap:10px;">
        <div style="flex:1;min-width:200px;">
          <h3>Partir d'un modèle métier</h3>
          <div class="hint" style="margin:4px 0 0;">
            Crée d'un coup le parc type d'un secteur, avec les champs qui comptent
            pour la traçabilité. Rien n'est écrasé, tout reste modifiable ensuite.
          </div>
        </div>
        <button class="btn btn-sm" data-action="toggle-modeles">
          ${modeleState.ouvert ? 'Masquer' : 'Voir les modèles'}
        </button>
      </div>
      ${modeleState.ouvert ? `
        <div class="modeles">
          ${MODELES_METIERS.map((m) => `
            <div class="modele">
              <div class="modele-nom">${esc(m.nom)}</div>
              <div class="small muted">${esc(m.description)}</div>
              <div class="modele-types">${m.types.map((t) => esc(t.nom)).join(' · ')}</div>
              <button class="btn btn-sm btn-primary" data-action="appliquer-modele"
                      data-cle="${attr(m.cle)}" ${modeleState.busy ? 'disabled' : ''}>
                ${modeleState.busy ? 'Création…' : `Ajouter ces ${m.types.length} types`}
              </button>
            </div>`).join('')}
        </div>` : ''}
    </div>
  `;
}

function renderTypeForm() {
  const champsRows = typeForm.champs.map((c, i) => `
    <div class="champ-row">
      <input type="text" placeholder="Nom du champ (ex : Kilométrage)"
             value="${attr(c.label)}" data-action="champ-label" data-i="${i}">
      <select data-action="champ-type" data-i="${i}">
        ${CHAMP_TYPES.map((ct) => `
          <option value="${attr(ct.v)}" ${ct.v === c.type ? 'selected' : ''}>${esc(ct.l)}</option>
        `).join('')}
      </select>
      <button type="button" class="icon-btn" data-action="champ-remove" data-i="${i}" title="Supprimer">✕</button>
    </div>
  `).join('');

  const modification = !!typeForm.id;

  return `
    <div class="card" style="margin-bottom:14px;">
      <h3>${modification ? 'Modifier le type' : 'Nouveau type'}</h3>
      ${typeForm.error ? `<div class="alert alert-error">${esc(typeForm.error)}</div>` : ''}
      <div class="field" style="margin-top:12px;">
        <label>Nom du type</label>
        <input type="text" placeholder="Ex : Véhicule" value="${attr(typeForm.nom)}" data-action="type-nom">
      </div>
      <label>Champs personnalisés (optionnel)</label>
      <div style="margin-bottom:8px;">${champsRows}</div>
      <button type="button" class="btn btn-sm" data-action="champ-add">+ Ajouter un champ</button>
      <div class="hint">
        Ces champs apparaîtront dans le formulaire d'ajout d'équipement de ce type
        (ex : marque, modèle, capacité, kilométrage…).
      </div>
      ${modification ? `
        <div class="hint">
          Ajouter un champ est sans risque : les équipements existants l'afficheront, vide,
          jusqu'à ce qu'il soit renseigné. Retirer un champ le fait disparaître des fiches
          mais n'efface rien : le remettre avec le même nom fait réapparaître les valeurs.
        </div>` : ''}
      <div class="row wrap" style="margin-top:14px;">
        <button class="btn btn-primary" data-action="save-type" ${typeForm.busy ? 'disabled' : ''}>
          ${typeForm.busy ? 'Enregistrement…' : (modification ? 'Enregistrer les modifications' : 'Enregistrer le type')}
        </button>
        <button class="btn" type="button" data-action="toggle-type-form">Annuler</button>
      </div>
    </div>
  `;
}

/* =========================================================================
   ACTIONS
   ========================================================================= */

export function ouvrirTypeForm(type) {
  typeForm = type
    ? {
        open: true, id: type.id, nom: type.nom,
        // On conserve la clé d'origine de chaque champ : c'est elle qui relie
        // le champ aux valeurs déjà saisies sur les équipements existants.
        champs: (type.champs || []).map((c) => ({ key: c.key, label: c.label, type: c.type })),
        busy: false, error: '',
      }
    : { open: true, id: null, nom: '', champs: [], busy: false, error: '' };
  render();
}

export function basculerTypeForm() {
  if (typeForm.open) {
    typeForm = typeFormVide();
    render();
  } else {
    ouvrirTypeForm(null);
  }
}

export function editerType(id) {
  const type = state.types.find((x) => x.id === id);
  if (type) ouvrirTypeForm(type);
}

export async function saveType() {
  typeForm.error = '';
  const nom = typeForm.nom.trim();
  if (!nom) { typeForm.error = 'Le nom du type est obligatoire.'; render(); return; }

  const champs = typeForm.champs
    .filter((c) => c.label.trim())
    // c.key existe déjà pour un champ créé précédemment : on le garde, sinon
    // renommer un libellé détacherait le champ des valeurs déjà saisies.
    .map((c) => ({ key: c.key || slugify(c.label), label: c.label.trim(), type: c.type }));

  typeForm.busy = true; render();
  try {
    if (typeForm.id) {
      await modifierType(typeForm.id, nom, champs);
    } else {
      await creerType(state.profile.organization_id, nom, champs);
    }
    typeForm = typeFormVide();
    await rechargerTypes();
    dashboardCache.items = null;
    render();
  } catch (e) {
    typeForm.busy = false;
    typeForm.error = e.message;
    render();
  }
}

export async function appliquerModele(cle) {
  const modele = MODELES_METIERS.find((m) => m.cle === cle);
  if (!modele) return;

  // On ne recrée pas ce qui existe déjà : le modèle complète, il n'écrase jamais.
  const existants = new Set(state.types.map((t) => (t.nom || '').trim().toLowerCase()));
  const aCreer = modele.types.filter((t) => !existants.has(t.nom.trim().toLowerCase()));

  if (!aCreer.length) {
    alert('Tous les types de ce modèle sont déjà présents dans cette organisation.');
    return;
  }

  const resume = aCreer.map((t) => '  • ' + t.nom).join('\n');
  const ignores = modele.types.length - aCreer.length;
  if (!confirm(
    `Ajouter ${aCreer.length} type(s) d'équipement :\n\n${resume}\n\n`
    + (ignores ? `${ignores} type(s) déjà présent(s) seront ignorés.\n\n` : '')
    + `Vous pourrez ensuite renommer, ajouter ou retirer des champs librement.`)) return;

  modeleState.busy = true; render();
  try {
    await creerTypes(aCreer.map((t) => ({
      organization_id: state.profile.organization_id,
      nom: t.nom,
      champs: t.champs.map((c) => ({ key: slugify(c.label), label: c.label, type: c.type })),
    })));
    await rechargerTypes();
    modeleState = { ouvert: false, busy: false };
    dashboardCache.items = null;
    render();
  } catch (e) {
    modeleState.busy = false;
    render();
    alert('Erreur : ' + e.message);
  }
}

async function rechargerTypes() {
  state.types = await listTypes();
  state.typesLoaded = true;
  mettreEnCacheTypes(state.types);
}

/* Saisie du formulaire — appelée par la délégation d'événements. */
export const typeFormInput = {
  nom(v) { typeForm.nom = v; },
  champLabel(i, v) { typeForm.champs[i].label = v; },
  champType(i, v) { typeForm.champs[i].type = v; },
  ajouterChamp() { typeForm.champs.push({ label: '', type: 'text' }); render(); },
  retirerChamp(i) { typeForm.champs.splice(i, 1); render(); },
  basculerModeles() { modeleState.ouvert = !modeleState.ouvert; render(); },
};
