/* =========================================================================
   WiTracEQUIP — gestion de l'équipe
   -------------------------------------------------------------------------
   Deux mécanismes de cloisonnement se superposent ici, et il est important
   de ne pas les confondre :

   1. LE RÔLE dit ce qu'une personne a le droit de FAIRE.
        utilisateur  → créer, remplir, imprimer
        responsable  → idem + retirer un équipement du parc
        admin        → idem + gérer l'équipe et le cloisonnement

   2. LE PÉRIMÈTRE MÉTIER dit ce qu'elle a le droit de VOIR.
        Un garagiste ne voit que les véhicules, un biomédical que les
        dispositifs médicaux. Ce n'est pas un filtre d'affichage : la
        politique RLS `type_autorise()` s'applique dans Postgres, si bien
        qu'un profil restreint interrogeant l'API directement n'obtiendrait
        rien de plus que ce que l'écran lui montre.
        Un administrateur voit tout par construction : il doit pouvoir
        administrer ce qu'il ne verrait pas autrement.

   LE FONDATEUR est intouchable depuis l'application : ni changement de rôle,
   ni suspension, ni suppression. C'est ce qui empêche un administrateur
   nouvellement promu de déloger celui qui l'a nommé et de prendre
   l'organisation en otage.

   Enfin, un administrateur d'organisation ne peut émettre que des invitations
   « responsable » ou « utilisateur » : la politique RLS de la table `invites`
   le lui impose. Créer une nouvelle organisation reste un acte de l'éditeur,
   depuis le SQL Editor de Supabase.
   ========================================================================= */

import { state, render } from '../core/store.js';
import { esc, attr, fmtDate, initials, copierDansPressePapier } from '../core/dom.js';
import { ROLE_LABELS, ROLES_ASSIGNABLES, ROLE_RESUME } from '../config.js';
import {
  listMembers, listInvites, listAcces, createInvite, cancelInvite,
  setMemberRole, setMemberActive, setAccesTousTypes, setAccesType, supprimerProfil,
} from '../services/supabase.js';
import { inviteUrl } from './routing.js';

function libelleRole(r) { return ROLE_LABELS[r] || r || '—'; }

/* Un seul endroit définit cet état : le dupliquer, c'est oublier un champ
   lors d'une remise à zéro et casser la vue au retour de connexion. */
let equipeCache;
export function resetEquipeCache() {
  equipeCache = {
    members: null, invites: null, acces: null, loading: false, error: '',
    inviteRole: 'utilisateur', inviteLabel: '', inviteBusy: false, inviteError: '',
    inviteTousTypes: true, inviteTypes: [],
    dernierToken: null,
  };
}
resetEquipeCache();

function chargerEquipe(force) {
  if (equipeCache.loading) return;
  if (equipeCache.members !== null && !force) return;
  equipeCache.loading = true;
  Promise.all([listMembers(), listInvites(), listAcces()])
    .then(([m, i, a]) => {
      equipeCache.members = m;
      equipeCache.invites = i;
      equipeCache.acces = a;
      equipeCache.loading = false;
      equipeCache.error = '';
      render();
    })
    .catch((e) => {
      equipeCache.error = e.message;
      equipeCache.loading = false;
      render();
    });
}

function rafraichirEquipe() {
  equipeCache.members = null;
  chargerEquipe(true);
}

export function viewNonAutorise() {
  return `<div class="alert alert-error">Cette section est réservée à l'administrateur.</div>`;
}

/* =========================================================================
   VUE
   ========================================================================= */

export function viewEquipe() {
  chargerEquipe(false);

  if (equipeCache.error) return `<div class="alert alert-error">${esc(equipeCache.error)}</div>`;
  if (equipeCache.members === null) return `<div class="spinner"></div>`;

  const moi = state.profile?.id;
  const acces = equipeCache.acces || [];

  const membres = equipeCache.members.map((m) => {
    const estMoi = m.id === moi;
    const estAdmin = m.role === 'admin';
    const estFondateur = !!m.fondateur;
    const verrouille = estFondateur || estMoi;

    // Un administrateur voit tout par construction : pas de cloisonnement à régler.
    const blocAcces = estAdmin ? '' : `
      <div class="acces">
        <label class="case">
          <input type="checkbox" data-action="acces-tous" data-id="${attr(m.id)}" ${m.acces_tous_types ? 'checked' : ''}>
          <span><strong>Tous les types d'équipement</strong></span>
        </label>
        ${m.acces_tous_types
          ? `<div class="small muted" style="margin-left:24px;">Ce profil voit l'ensemble du parc.</div>`
          : (state.types.length
              ? `<div class="acces-liste">
                   ${state.types.map((t) => `
                     <label class="case">
                       <input type="checkbox" data-action="acces-type"
                              data-id="${attr(m.id)}" data-type="${attr(t.id)}"
                              ${acces.some((a) => a.profile_id === m.id && a.type_id === t.id) ? 'checked' : ''}>
                       <span>${esc(t.nom)}</span>
                     </label>`).join('')}
                 </div>`
              : `<div class="small muted" style="margin-left:24px;">Aucun type d'équipement à attribuer.</div>`)}
      </div>`;

    return `
      <div class="member">
        <div class="thumb">${initials(m.full_name)}</div>
        <div class="who">
          <div style="font-weight:650;">
            ${esc(m.full_name || 'Sans nom')}
            ${estMoi ? '<span class="small muted">(vous)</span>' : ''}
            ${estFondateur ? '<span class="badge badge-neutral">fondateur</span>' : ''}
            ${!m.active ? '<span class="badge badge-off">suspendu</span>' : ''}
          </div>
          <div class="small muted">Membre depuis le ${fmtDate(m.created_at)}</div>
        </div>
        ${verrouille
          ? `<span class="badge badge-role">${esc(libelleRole(m.role))}</span>`
          : `<select data-action="member-role" data-id="${attr(m.id)}">
               ${ROLES_ASSIGNABLES.map((r) => `
                 <option value="${attr(r)}" ${r === m.role ? 'selected' : ''}>${esc(libelleRole(r))}</option>
               `).join('')}
             </select>`}
        ${verrouille ? '' : `
          <button class="btn btn-sm ${m.active ? 'btn-danger' : ''}"
                  data-action="member-active" data-id="${attr(m.id)}" data-active="${m.active ? '0' : '1'}">
            ${m.active ? 'Suspendre' : 'Réactiver'}
          </button>
          <button class="btn btn-sm btn-danger" data-action="member-supprimer"
                  data-id="${attr(m.id)}" data-nom="${attr(m.full_name || 'ce profil')}">
            Supprimer
          </button>`}
        ${blocAcces}
      </div>`;
  }).join('');

  const invitations = (equipeCache.invites || []).map((i) => `
    <div class="member">
      <div class="who">
        <div style="font-weight:650;">
          ${esc(i.label || 'Invitation')}
          <span class="badge badge-role">${esc(libelleRole(i.role))}</span>
        </div>
        <div class="small muted">
          ${i.acces_tous_types
            ? 'Tous les types'
            : 'Accès : ' + esc(state.types.filter((t) => (i.types_autorises || []).includes(t.id))
                .map((t) => t.nom).join(', ') || 'aucun type')}
          · valable jusqu'au ${fmtDate(i.expires_at)}
        </div>
        <div class="invite-link">
          <code>${esc(inviteUrl(i.token))}</code>
          <button class="btn btn-sm" data-action="copier-lien" data-token="${attr(i.token)}">Copier</button>
        </div>
      </div>
      <button class="btn btn-sm btn-danger" data-action="annuler-invite" data-id="${attr(i.id)}">Annuler</button>
    </div>
  `).join('');

  return `
    <div class="row between wrap" style="margin-bottom:14px;">
      <h2>Équipe</h2>
      <span class="badge badge-role">${esc(state.orgName || '')}</span>
    </div>

    <div class="card">
      <h3>Inviter quelqu'un</h3>
      <div class="hint" style="margin-bottom:12px;">
        Vous fixez le rôle <strong>et</strong> le périmètre métier avant d'envoyer le lien.
        La personne rejoint votre organisation avec exactement ces droits, sans pouvoir
        les choisir ni les modifier.
      </div>
      ${equipeCache.inviteError ? `<div class="alert alert-error">${esc(equipeCache.inviteError)}</div>` : ''}

      <div class="grid-2">
        <div class="field">
          <label>Rôle</label>
          <select data-action="invite-role">
            ${ROLES_ASSIGNABLES.map((r) => `
              <option value="${attr(r)}" ${r === equipeCache.inviteRole ? 'selected' : ''}>${esc(libelleRole(r))}</option>
            `).join('')}
          </select>
          <div class="hint">${esc(ROLE_RESUME[equipeCache.inviteRole] || '')}</div>
        </div>
        <div class="field">
          <label>Nom de la personne (facultatif)</label>
          <input type="text" placeholder="Ex : Marc Dupont"
                 value="${attr(equipeCache.inviteLabel)}" data-action="invite-label">
        </div>
      </div>

      ${equipeCache.inviteRole === 'admin' ? `
        <div class="alert alert-warn-admin">
          <strong>Ce profil aura tous les pouvoirs sur votre organisation :</strong>
          gérer le parc, inviter et supprimer des profils, et nommer d'autres administrateurs.
          Il verra l'ensemble des métiers. Il ne pourra en revanche jamais toucher à votre
          propre profil, protégé en tant que fondateur.
        </div>
      ` : `
      <label>Périmètre métier</label>
      <div class="acces" style="margin-bottom:12px;">
        <label class="case">
          <input type="checkbox" data-action="invite-tous-types" ${equipeCache.inviteTousTypes ? 'checked' : ''}>
          <span><strong>Tous les types d'équipement</strong></span>
        </label>
        ${equipeCache.inviteTousTypes
          ? `<div class="small muted" style="margin-left:24px;">Cette personne verra l'ensemble du parc.</div>`
          : (state.types.length
              ? `<div class="acces-liste">
                   ${state.types.map((t) => `
                     <label class="case">
                       <input type="checkbox" data-action="invite-type" data-type="${attr(t.id)}"
                              ${equipeCache.inviteTypes.includes(t.id) ? 'checked' : ''}>
                       <span>${esc(t.nom)}</span>
                     </label>`).join('')}
                 </div>
                 <div class="small muted" style="margin-left:24px;margin-top:6px;">
                   ${equipeCache.inviteTypes.length
                     ? 'Ne verra que : ' + esc(state.types.filter((t) => equipeCache.inviteTypes.includes(t.id))
                         .map((t) => t.nom).join(', '))
                     : 'Aucun type coché : cette personne ne verrait aucun équipement.'}
                 </div>`
              : `<div class="small muted" style="margin-left:24px;">Aucun type d'équipement créé pour l'instant.</div>`)}
      </div>`}

      <div class="row wrap">
        <button class="btn btn-primary" data-action="creer-invite" ${equipeCache.inviteBusy ? 'disabled' : ''}>
          ${equipeCache.inviteBusy ? 'Création…' : 'Générer le lien'}
        </button>
      </div>
      ${equipeCache.dernierToken ? `
        <div class="alert alert-success" style="margin:14px 0 0;">
          Lien créé — transmettez-le à la personne concernée.
          <div class="invite-link">
            <code>${esc(inviteUrl(equipeCache.dernierToken))}</code>
            <button class="btn btn-sm" data-action="copier-lien" data-token="${attr(equipeCache.dernierToken)}">Copier</button>
          </div>
        </div>` : ''}
    </div>

    <div class="card">
      <h3>Membres (${equipeCache.members.length})</h3>
      ${membres || `<div class="empty small">Aucun membre.</div>`}
    </div>

    <div class="card">
      <h3>Invitations en attente (${(equipeCache.invites || []).length})</h3>
      ${invitations || `<div class="empty small">Aucune invitation en attente.</div>`}
    </div>
  `;
}

/* =========================================================================
   ACTIONS
   ========================================================================= */

export async function actionCreerInvite() {
  // Un administrateur voit tout par construction : pas de périmètre à restreindre.
  const estAdmin = equipeCache.inviteRole === 'admin';
  if (estAdmin) {
    equipeCache.inviteTousTypes = true;
    equipeCache.inviteTypes = [];
  }

  if (estAdmin && !confirm(
    "Créer un lien d'invitation ADMINISTRATEUR ?\n\n"
    + "Cette personne pourra gérer tout le parc, inviter et supprimer des profils, "
    + "et nommer d'autres administrateurs.\n\n"
    + "Elle ne pourra jamais toucher à votre propre profil, protégé en tant que fondateur.")) return;

  if (!equipeCache.inviteTousTypes && equipeCache.inviteTypes.length === 0) {
    equipeCache.inviteError = "Choisissez au moins un type d'équipement, sinon cette personne n'aurait accès à rien.";
    render(); return;
  }

  equipeCache.inviteError = '';
  equipeCache.inviteBusy = true;
  render();

  try {
    const inv = await createInvite(
      state.profile.organization_id,
      equipeCache.inviteRole,
      equipeCache.inviteLabel.trim(),
      equipeCache.inviteTousTypes,
      equipeCache.inviteTypes,
    );
    equipeCache.dernierToken = inv.token;
    equipeCache.inviteLabel = '';
    equipeCache.invites = await listInvites();
  } catch (e) {
    equipeCache.inviteError = e.message;
  } finally {
    equipeCache.inviteBusy = false;
    render();
  }
}

export async function actionAnnulerInvite(id) {
  if (!confirm("Annuler cette invitation ? Le lien ne fonctionnera plus.")) return;
  try {
    await cancelInvite(id);
    equipeCache.invites = await listInvites();
    render();
  } catch (e) { alert('Erreur : ' + e.message); }
}

export async function actionRoleMembre(id, role) {
  if (role === 'admin' && !confirm(
    "Promouvoir ce profil ADMINISTRATEUR ?\n\n"
    + "Il pourra gérer tout le parc, inviter et supprimer des profils, "
    + "et nommer d'autres administrateurs.\n\n"
    + "Votre propre profil restera protégé en tant que fondateur.")) {
    rafraichirEquipe(); return;
  }
  try {
    await setMemberRole(id, role);
    rafraichirEquipe();
  } catch (e) { alert('Erreur : ' + e.message); rafraichirEquipe(); }
}

export async function actionSupprimerMembre(id, nom) {
  const msg =
    `Supprimer définitivement le profil de ${nom} ?\n\n`
    + `• Son compte de connexion est effacé de la base\n`
    + `• Il ne pourra plus jamais se connecter\n`
    + `• L'historique des interventions qu'il a enregistrées est CONSERVÉ\n\n`
    + `Cette action est irréversible. Pour un départ temporaire, préférez « Suspendre ».`;
  if (!confirm(msg)) return;
  try {
    await supprimerProfil(id);
    rafraichirEquipe();
  } catch (e) { alert('Erreur : ' + e.message); rafraichirEquipe(); }
}

export async function actionActiverMembre(id, active) {
  const msg = active
    ? "Réactiver ce profil ? La personne retrouvera l'accès à l'application."
    : "Suspendre ce profil ? La personne perdra immédiatement l'accès à toutes les données, sans rien supprimer.";
  if (!confirm(msg)) return;
  try {
    await setMemberActive(id, active);
    rafraichirEquipe();
  } catch (e) { alert('Erreur : ' + e.message); rafraichirEquipe(); }
}

export async function actionAccesTous(id, valeur) {
  try {
    await setAccesTousTypes(id, valeur);
    rafraichirEquipe();
  } catch (e) { alert('Erreur : ' + e.message); rafraichirEquipe(); }
}

export async function actionAccesType(profileId, typeId, autoriser) {
  try {
    await setAccesType(profileId, typeId, autoriser);
    rafraichirEquipe();
  } catch (e) { alert('Erreur : ' + e.message); rafraichirEquipe(); }
}

export function copierLienInvitation(token, btn) {
  copierDansPressePapier(inviteUrl(token), btn);
}

/* Saisie du formulaire d'invitation. */
export const inviteInput = {
  role(v) { equipeCache.inviteRole = v; render(); },
  label(v) { equipeCache.inviteLabel = v; },
  tousTypes(checked) {
    equipeCache.inviteTousTypes = checked;
    if (checked) equipeCache.inviteTypes = [];
    equipeCache.inviteError = '';
    render();
  },
  type(id, checked) {
    equipeCache.inviteTypes = checked
      ? [...new Set([...equipeCache.inviteTypes, id])]
      : equipeCache.inviteTypes.filter((x) => x !== id);
    equipeCache.inviteError = '';
    render();
  },
};
