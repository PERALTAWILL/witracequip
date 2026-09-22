/* =========================================================================
   WiTracEQUIP — interventions
   -------------------------------------------------------------------------
   L'intervention est l'unité de valeur du produit. Le reste de l'application
   — types, QR codes, profils — n'existe que pour qu'une ligne soit ajoutée
   ici, au bon appareil, par la bonne personne, à la bonne date.

   Règle métier non négociable : l'INTERVENANT est obligatoire. Elle est
   appliquée trois fois, volontairement :
     - ici, à la saisie, avec un message qui explique pourquoi ;
     - dans js/services/supabase.js, avant l'envoi ;
     - dans Postgres : `check (btrim(technicien) <> '')`.
   Un carnet d'entretien sans nom d'intervenant ne vaut pas preuve en cas de
   contrôle ou de litige. La contrainte SQL est celle qui compte vraiment :
   les deux autres ne font qu'expliquer le refus avant qu'il ne survienne.

   Ce module ne détient aucun état : il reçoit ce qu'il affiche et rend la
   main à js/modules/equipements.js, qui possède la fiche courante. C'est ce
   qui évite un cycle d'imports entre les deux.
   ========================================================================= */

import { esc, attr, fmtDate, aujourdhui } from '../core/dom.js';
import { state } from '../core/store.js';
import { creerIntervention } from '../services/supabase.js';
import { mettreEnAttenteIntervention } from '../services/offline.js';

/* =========================================================================
   FORMULAIRE DE SAISIE
   ========================================================================= */

export function renderIvForm({ busy, error }) {
  return `
    <form class="card" style="background:var(--surface-2);margin:12px 0;" data-action="submit-iv">
      ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
      ${!state.enLigne ? `
        <div class="alert alert-info">
          Hors connexion : cette intervention sera enregistrée sur cet appareil
          et envoyée automatiquement dès le retour du réseau.
        </div>` : ''}
      <div class="grid-2">
        <div class="field">
          <label>Date <span class="oblig">obligatoire</span></label>
          <input type="date" name="date" value="${attr(aujourdhui())}" required>
        </div>
        <div class="field">
          <label>Type d'intervention <span class="oblig">obligatoire</span></label>
          <input type="text" name="type" placeholder="Ex : Entretien, Réparation, Contrôle…" required>
        </div>
      </div>
      <div class="field">
        <label>Intervenant <span class="oblig">obligatoire</span></label>
        <input type="text" name="technicien" value="${attr(state.profile?.full_name || '')}" required
               placeholder="Nom de la personne intervenue">
        <div class="hint">Nom de la personne qui a réalisé l'intervention. C'est lui qui figurera
          sur le carnet en cas de contrôle — pré-rempli avec le vôtre, modifiable si vous
          saisissez pour un collègue.</div>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea name="description" placeholder="Détails de l'intervention…"></textarea>
      </div>
      <button class="btn btn-primary" type="submit" ${busy ? 'disabled' : ''}>
        ${busy ? 'Enregistrement…' : "Enregistrer l'intervention"}
      </button>
    </form>
  `;
}

/* =========================================================================
   SOUMISSION
   ========================================================================= */

/**
 * Valide puis enregistre une intervention.
 *
 * Hors connexion, elle part dans la file d'attente locale plutôt que d'être
 * perdue : le technicien a fait le travail, la trace ne doit pas dépendre de
 * la présence d'une barre de réseau dans un sous-sol.
 *
 * Renvoie { ok } ou { erreur } — l'appelant décide quoi rafraîchir.
 */
export async function soumettreIntervention(form, equipementId) {
  // On lit et on valide AVANT tout réaffichage : une fiche d'intervention sans
  // intervenant ni date n'a aucune valeur de preuve, elle ne doit pas partir.
  const fd = new FormData(form);
  const date        = String(fd.get('date') || '').trim();
  const type        = String(fd.get('type') || '').trim();
  const technicien  = String(fd.get('technicien') || '').trim();
  const description = String(fd.get('description') || '').trim();

  if (!date) {
    return { erreur: "La date de l'intervention est obligatoire." };
  }
  if (!type) {
    return { erreur: "Le type d'intervention est obligatoire (entretien, réparation, contrôle…)." };
  }
  if (!technicien) {
    return { erreur: "Le nom de l'intervenant est obligatoire : c'est lui qui engage la traçabilité de la fiche." };
  }

  const payload = { equipementId, date, type, technicien, description };

  if (!state.enLigne) {
    mettreEnAttenteIntervention(payload);
    return { ok: true, enAttente: true };
  }

  try {
    await creerIntervention(payload);
    return { ok: true, enAttente: false };
  } catch (e) {
    // Une panne réseau survenue pendant l'envoi ne doit pas faire perdre la
    // saisie : elle bascule dans la file d'attente comme si l'on avait été
    // hors ligne dès le départ.
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
      state.enLigne = false;
      mettreEnAttenteIntervention(payload);
      return { ok: true, enAttente: true };
    }
    return { erreur: e?.message || String(e) };
  }
}

/* =========================================================================
   HISTORIQUE
   ========================================================================= */

/**
 * Tableau d'historique d'un équipement.
 * `interventions` mêle les lignes venues de la base et celles encore en
 * attente d'envoi ; ces dernières portent `en_attente` et sont signalées,
 * car une trace pas encore partie n'est pas encore une preuve.
 */
export function renderHistorique(interventions) {
  if (!interventions || !interventions.length) {
    return `<div class="empty small">Aucune intervention enregistrée.</div>`;
  }

  const lignes = interventions.map((iv) => `
    <tr class="${iv.en_attente ? 'en-attente' : ''}">
      <td>${fmtDate(iv.date)}</td>
      <td>${esc(iv.type)}</td>
      <td>${esc(iv.technicien)}</td>
      <td class="muted">
        ${esc(iv.description || '—')}
        ${iv.en_attente ? `<div><span class="badge badge-attente">en attente d'envoi</span></div>` : ''}
        ${iv.erreur ? `<div class="small" style="color:var(--danger);margin-top:4px;">Refusé par le serveur : ${esc(iv.erreur)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Technicien</th><th>Description</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  `;
}
