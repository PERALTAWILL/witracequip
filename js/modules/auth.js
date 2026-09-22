/* =========================================================================
   WiTracEQUIP — authentification et accès
   -------------------------------------------------------------------------
   L'inscription libre n'existe pas. Un compte ne peut naître que de
   l'ouverture d'un lien d'invitation, et ce n'est pas un réglage d'interface :
   la fonction handle_new_user() de Postgres refuse toute création de compte
   sans jeton valide (sql/03-inscription-fermee.sql). Retirer l'écran
   d'inscription de l'application ne fermerait rien du tout — c'est la base
   qui ferme la porte.

   Deux sortes d'invitations :
     - invitation « nouveau client » (organization_id NULL) : crée
       l'organisation et son premier administrateur. Générée par l'éditeur,
       depuis le SQL Editor de Supabase, jamais depuis l'application.
     - invitation d'équipe : rattache une personne à une organisation
       existante, avec le rôle et le périmètre métier fixés par l'admin qui
       l'émet. L'invité ne choisit pas ses propres droits.
   ========================================================================= */

import { state, render, resetSessionState } from '../core/store.js';
import { esc, attr, champMotDePasse } from '../core/dom.js';
import { sb, chargerProfilEtOrg, listTypes, invitePreview } from '../services/supabase.js';
import { mettreEnCacheTypes, lireTypesEnCache, viderCache, synchroniser } from '../services/offline.js';
import { nav } from './routing.js';
import { ROLE_LABELS } from '../config.js';

const LOGO = 'assets/icons/icon-512.png';

function libelleRole(r) { return ROLE_LABELS[r] || r || '—'; }

/* =========================================================================
   ÉCRAN DE CONNEXION
   ========================================================================= */

export function renderAuth() {
  return `
    <div class="auth-wrap">
      <div class="auth-logo">
        <img class="logo" src="${LOGO}" alt="WiTracEQUIP">
        <h1 style="font-size:20px;">WiTracEQUIP</h1>
        <div class="small muted">Le passeport technique de vos équipements — by WiDIAG MQ</div>
      </div>

      ${state.authError ? `<div class="alert alert-error">${esc(state.authError)}</div>` : ''}
      ${state.authNotice ? `<div class="alert alert-success">${esc(state.authNotice)}</div>` : ''}
      ${!state.enLigne ? `
        <div class="alert alert-info">
          Vous êtes hors connexion. La première connexion à WiTracEQUIP nécessite
          un accès au réseau ; une fois connecté, l'application reste utilisable
          sans réseau.
        </div>` : ''}

      <form class="card stack" data-action="submit-auth">
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" placeholder="vous@exemple.com" required autocomplete="email">
        </div>
        <div class="field">
          <label>Mot de passe</label>
          ${champMotDePasse('current-password')}
        </div>
        <button class="btn btn-primary btn-block" type="submit" ${state.authBusy ? 'disabled' : ''}>
          ${state.authBusy ? '…' : 'Se connecter'}
        </button>
      </form>

      <div class="small muted" style="text-align:center;margin-top:14px;">
        L'accès à WiTracEQUIP se fait uniquement sur invitation.<br>
        Vous avez reçu un lien d'invitation ? Ouvrez-le pour créer votre compte.
      </div>
    </div>
  `;
}

export async function handleAuthSubmit(form) {
  state.authError = '';
  state.authNotice = '';
  state.authBusy = true;
  render();

  const fd = new FormData(form);
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: String(fd.get('email') || '').trim(),
      password: fd.get('password'),
    });
    if (error) throw error;
    // La suite est prise en charge par onAuthStateChange (voir initAuth).
  } catch (e) {
    state.authError = traduireErreurAuth(e.message || String(e));
  } finally {
    state.authBusy = false;
    render();
  }
}

/* =========================================================================
   ÉCRAN D'ACCÈS SUSPENDU
   ========================================================================= */

export function renderAccesSuspendu() {
  const suspendu = state.accessError === 'ACCES_SUSPENDU';
  return `
    <div class="auth-wrap">
      <div class="auth-logo">
        <h1 style="font-size:20px;">${suspendu ? 'Accès suspendu' : 'Connexion impossible'}</h1>
      </div>
      <div class="card stack">
        <div class="alert alert-error" style="margin:0;">
          ${suspendu
            ? "Votre accès à WiTracEQUIP est actuellement suspendu."
            : esc(state.accessError)}
        </div>
        <div class="small muted">
          ${suspendu
            ? "Contactez l'administrateur de votre organisation pour le rétablir."
            : "Réessayez dans un instant, ou reconnectez-vous."}
        </div>
        <button class="btn btn-block" data-action="logout">Se déconnecter</button>
      </div>
    </div>
  `;
}

/* =========================================================================
   ÉCRAN D'INVITATION
   ========================================================================= */

let joinState = { token: null, loading: false, preview: null, error: '', busy: false, notice: '' };

export function resetJoinState() {
  joinState = { token: null, loading: false, preview: null, error: '', busy: false, notice: '' };
}

export function renderJoin(token) {
  if (joinState.token !== token) {
    joinState = { token, loading: true, preview: null, error: '', busy: false, notice: '' };
    invitePreview(token)
      .then((preview) => { joinState.preview = preview; joinState.loading = false; render(); })
      .catch((e) => { joinState.error = e.message; joinState.loading = false; render(); });
  }

  if (joinState.loading) return `<div class="center-screen"><div class="spinner"></div></div>`;

  const p = joinState.preview;
  const invalide = !p || !p.valid;

  return `
    <div class="auth-wrap">
      <div class="auth-logo">
        <img class="logo" src="${LOGO}" alt="WiTracEQUIP">
        <h1 style="font-size:20px;">WiTracEQUIP</h1>
      </div>

      ${invalide ? `
        <div class="card">
          <div class="alert alert-error" style="margin:0;">
            Ce lien d'invitation n'est plus valable : il a déjà été utilisé, il a expiré, ou il a été annulé.
          </div>
          <div class="small muted" style="margin-top:12px;">
            Demandez un nouveau lien à l'administrateur de votre organisation.
          </div>
          <button class="btn btn-block" style="margin-top:14px;" data-action="go" data-path="/">
            Retour à la connexion
          </button>
        </div>
      ` : `
        <div class="alert alert-info">
          ${p.invite_role === 'admin'
            ? `Vous allez créer l'organisation <strong>${esc(p.organization_name)}</strong>
               et en devenir l'<strong>administrateur</strong>.`
            : `Vous êtes invité à rejoindre <strong>${esc(p.organization_name)}</strong>
               en tant que <strong>${esc(libelleRole(p.invite_role))}</strong>.`}
        </div>
        ${joinState.error ? `<div class="alert alert-error">${esc(joinState.error)}</div>` : ''}
        ${joinState.notice ? `<div class="alert alert-success">${esc(joinState.notice)}</div>` : ''}
        <form class="card stack" data-action="submit-join">
          <div class="field">
            <label>Votre nom complet</label>
            <input type="text" name="full_name" placeholder="Prénom Nom" required>
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" placeholder="vous@exemple.com" required autocomplete="email">
          </div>
          <div class="field">
            <label>Mot de passe</label>
            ${champMotDePasse('new-password')}
          </div>
          <button class="btn btn-primary btn-block" type="submit" ${joinState.busy ? 'disabled' : ''}>
            ${joinState.busy ? '…' : 'Créer mon compte'}
          </button>
        </form>
      `}
    </div>
  `;
}

export async function handleJoinSubmit(form) {
  joinState.error = '';
  joinState.notice = '';
  joinState.busy = true;
  render();

  const fd = new FormData(form);
  try {
    const { data, error } = await sb.auth.signUp({
      email: String(fd.get('email') || '').trim(),
      password: fd.get('password'),
      options: {
        data: {
          full_name: String(fd.get('full_name') || '').trim(),
          invite_token: joinState.token,
        },
      },
    });
    if (error) throw error;
    if (!data.session) {
      joinState.notice = "Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.";
    }
  } catch (e) {
    joinState.error = traduireErreurAuth(e.message || String(e));
  } finally {
    joinState.busy = false;
    render();
  }
}

/* =========================================================================
   MESSAGES D'ERREUR
   -------------------------------------------------------------------------
   Supabase répond en anglais et en termes techniques. Les personnes qui
   utilisent WiTracEQUIP sont des techniciens de terrain, pas des
   développeurs : chaque message doit dire ce qui s'est passé et quoi faire
   ensuite. Les codes d'exception levés par nos propres fonctions SQL
   (INSCRIPTION_SUR_INVITATION, INVITE_INVALIDE, ORGANISATION_SUSPENDUE)
   arrivent ici tels quels et sont traduits de la même façon.
   ========================================================================= */

export function traduireErreurAuth(msg) {
  const m = String(msg || '').toLowerCase();

  if (m.includes('invalid login credentials')) return "Email ou mot de passe incorrect.";
  if (m.includes('user already registered') || m.includes('already registered')) return "Un compte existe déjà avec cet email.";
  if (m.includes('email not confirmed')) return "Merci de confirmer votre email avant de vous connecter (lien envoyé par email).";
  if (m.includes('password should be at least')) return "Le mot de passe doit faire au moins 6 caractères.";
  if (m.includes('inscription_sur_invitation')) return "La création de compte se fait uniquement via un lien d'invitation.";
  if (m.includes('organisation_suspendue')) return "L'organisation qui vous invite est actuellement suspendue. Contactez WiDIAG MQ.";
  if (m.includes('invite_invalide') || m.includes('database error saving new user')) {
    return "Ce lien d'invitation n'est plus valable. Demandez-en un nouveau à votre administrateur.";
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion réseau.";
  }
  return msg;
}

/* =========================================================================
   DÉMARRAGE DE LA SESSION
   ========================================================================= */

/**
 * Branche le suivi de session.
 *
 * `onAuthStateChange` est appelé au chargement de la page (restauration d'une
 * session mémorisée), à la connexion et à la déconnexion : c'est le seul point
 * d'entrée du cycle de vie de la session, ce qui évite d'avoir deux chemins
 * de démarrage à maintenir en parallèle.
 *
 * `auReset` est fourni par app.js pour vider les caches de vue : le module
 * d'authentification n'a pas à connaître le tableau de bord.
 */
export function initAuth(auReset) {
  sb.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    state.accessError = '';

    if (session) {
      try {
        const { profile, orgName } = await chargerProfilEtOrg(session.user.id);
        state.profile = profile;
        state.orgName = orgName;

        state.types = await listTypes();
        state.typesLoaded = true;
        mettreEnCacheTypes(state.types);

        // Tout ce qui a été saisi hors ligne part maintenant.
        synchroniser();
      } catch (e) {
        // Hors ligne au démarrage : la session mémorisée reste valide, on
        // repart des types mis en cache plutôt que de bloquer l'application.
        if (!state.enLigne || /failed to fetch|networkerror/i.test(e?.message || '')) {
          state.types = lireTypesEnCache();
          state.typesLoaded = state.types.length > 0;
          state.enLigne = false;
        } else {
          console.error(e);
          state.accessError = e?.message || 'Erreur de chargement du profil.';
        }
      }
    } else {
      resetSessionState();
      resetJoinState();
      viderCache();
      if (auReset) auReset();
    }

    state.loading = false;
    render();
  });
}

/** Déconnexion. */
export function logout() {
  sb.auth.signOut();
  nav('/');
}
