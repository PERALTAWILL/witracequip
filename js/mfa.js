/* ---------------------------------------------------------------------- */
/* Double authentification (TOTP) — compte fondateur                       */
/* ---------------------------------------------------------------------- */
/* Deux morceaux :
   1. À la connexion : si le compte a un facteur actif, le mot de passe ne suffit
      plus. L'écran « code à 6 chiffres » s'affiche AVANT le chargement de quoi que
      ce soit (voir appliquerSession et peindre dans app.js).
   2. Dans l'espace fondateur : « Double authentification » pour activer, ajouter un
      appareil de secours ou retirer un appareil.

   IMPORTANT : ce contrôle côté navigateur est un confort d'affichage, pas une
   barrière. La vraie protection est dans la base : sql/24-mfa-fondateur.sql fait
   exiger le niveau « aal2 » à is_super_admin() dès qu'un facteur est actif. */

const mfa = { requis: false, busy: false, erreur: '' };

function messageMfa(e){
const m = String((e && e.message) || e || '').toLowerCase();
if(m.includes('invalid') && (m.includes('totp') || m.includes('code'))) return "Code incorrect ou expiré. Saisissez le code actuel affiché par votre application.";
if(m.includes('too many') || m.includes('rate limit') || m.includes('over_request_rate_limit')) return "Trop d'essais. Patientez une minute puis réessayez.";
if(m.includes('enroll') && m.includes('disabled')) return "L'activation n'est pas autorisée dans les réglages d'authentification du projet Supabase.";
if(m.includes('aal2') || m.includes('assurance')) return "Reconnectez-vous avec votre code de double authentification pour effectuer cette action.";
return (e && e.message) || String(e);
}

/* true = on peut continuer ; false = il faut d'abord saisir le code. */
async function mfaVerifierNiveau(){
try{
const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
if(error || !data) return true; // la base reste la barrière : voir l'avertissement en tête de fichier
return !(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
}catch(e){ return true; }
}

/* ---------- 1. Écran de connexion : code à 6 chiffres ---------- */

function renderMfaDefi(){
return `
<div class="auth-wrap poste-ecran">
<div class="auth-logo">
<img class="logo brand-logo" src="${LOGO_DATA_URL}" alt="WiTracEQUIP">
<h1 style="font-size:20px;">Vérification en deux étapes</h1>
</div>
<form class="card poste-carte" data-action="submit-mfa-defi" novalidate>
<p style="margin:0 0 12px;">Ouvrez votre application d'authentification et saisissez le code à 6 chiffres de <b>WiTracEQUIP</b>.</p>
<label class="dlg-champ" style="margin-top:0;">
<span>Code à 6 chiffres</span>
<input id="mfa-code" type="text" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="one-time-code" spellcheck="false" placeholder="123456" style="letter-spacing:.3em; font-size:20px; text-align:center;" ${mfa.busy ? 'disabled' : ''}>
</label>
${mfa.erreur ? `<div class="dlg-erreur">${esc(mfa.erreur)}</div>` : ''}
<button type="submit" class="btn btn-primary btn-block" style="margin-top:14px;" ${mfa.busy ? 'disabled' : ''}>${mfa.busy ? 'Vérification…' : 'Valider'}</button>
<button type="button" class="btn btn-block" style="margin-top:8px;" data-action="logout">Se déconnecter</button>
</form>
</div>`;
}

async function mfaValiderDefi(form){
const code = String(new FormData(form).get('code') || '').replace(/\s/g, '');
if(!/^\d{6}$/.test(code)){ mfa.erreur = "Saisissez les 6 chiffres affichés par votre application."; render(); return; }
mfa.busy = true; mfa.erreur = ''; render();
let reussi = false;
try{
const { data, error } = await sb.auth.mfa.listFactors();
if(error) throw error;
const facteurs = (data.totp || []).filter(f => f.status === 'verified');
if(!facteurs.length) throw new Error("Aucun appareil de double authentification n'est actif sur ce compte.");
let derniere = null;
// Appareil principal puis appareil de secours : le code est valable pour l'un d'eux.
for(const f of facteurs){
const { error: err } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code });
if(!err){ reussi = true; break; }
derniere = err;
}
if(!reussi) throw derniere;
}catch(e){
mfa.erreur = messageMfa(e);
}
mfa.busy = false;
if(!reussi){ render(); setTimeout(() => document.getElementById('mfa-code')?.focus(), 30); return; }
mfa.requis = false;
state.loading = true; render();
const { data: s } = await sb.auth.getSession();
state.session = s.session;
appliquerSession(s.session);
}

/* ---------- 2. Espace fondateur : activer / gérer ---------- */

let mfaPanneau = null;       // <div class="dlg-fond"> en cours
let mfaEnCours = null;       // { id } d'un facteur créé mais pas encore validé

function mfaPanneauFermer(){
if(!mfaPanneau) return;
const fond = mfaPanneau; mfaPanneau = null;
document.removeEventListener('keydown', mfaClavier, true);
fond.classList.remove('visible');
setTimeout(() => fond.remove(), 180);
if(dialogueOuvert && dialogueOuvert.mfa) dialogueOuvert = null;
mfaAbandonner();
}
function mfaClavier(e){ if(e.key === 'Escape'){ e.stopPropagation(); mfaPanneauFermer(); } }

/* Un facteur créé puis abandonné (fenêtre fermée avant le premier code) est retiré :
   sinon il resterait en attente et gênerait la prochaine activation. */
async function mfaAbandonner(){
if(!mfaEnCours) return;
const id = mfaEnCours.id; mfaEnCours = null;
try{ await sb.auth.mfa.unenroll({ factorId: id }); }catch(e){}
}

function mfaEcran(html){
if(!mfaPanneau) return;
mfaPanneau.querySelector('.mfa-panneau').innerHTML = html;
const champ = mfaPanneau.querySelector('input[name="code"]');
if(champ) setTimeout(() => champ.focus(), 30);
}

async function mfaListerActifs(){
const { data, error } = await sb.auth.mfa.listFactors();
if(error) throw error;
// On nettoie les facteurs jamais validés (essais abandonnés).
for(const f of (data.all || []).filter(f => f.factor_type === 'totp' && f.status === 'unverified')){
try{ await sb.auth.mfa.unenroll({ factorId: f.id }); }catch(e){}
}
return (data.totp || []).filter(f => f.status === 'verified');
}

function mfaEcranListe(actifs){
const active = actifs.length > 0;
mfaEcran(`
<div class="dlg-titre">Double authentification</div>
<div class="dlg-corps">${active
? "Activée. À chaque connexion, votre mot de passe ne suffit plus : il faut aussi le code de votre application d'authentification."
: "Pas encore activée. Votre mot de passe est aujourd'hui la seule protection de l'accès à tous vos clients."}</div>
${active ? `<div class="mfa-liste">${actifs.map(f => `
<div class="mfa-ligne"><span><strong>${esc(f.friendly_name || 'Appareil')}</strong><small>Ajouté le ${esc(new Date(f.created_at).toLocaleDateString('fr-FR'))}</small></span>
<button type="button" class="btn btn-sm" data-mfa="retirer" data-id="${esc(f.id)}">Retirer</button></div>`).join('')}</div>
${actifs.length < 2 ? `<div class="dlg-corps" style="margin-top:10px;">Conseil : ajoutez un second appareil (ou une autre application) en secours. Sans code de récupération, perdre le seul appareil vous bloquerait.</div>` : ''}` : ''}
<div class="dlg-actions">
<button type="button" class="btn" data-mfa="fermer">Fermer</button>
<button type="button" class="btn btn-primary" data-mfa="commencer">${active ? 'Ajouter un appareil' : 'Activer'}</button>
</div>`);
}

async function mfaCommencer(){
mfaEcran(`<div class="dlg-titre">Double authentification</div><div class="dlg-corps">Préparation…</div>`);
try{
const nom = 'Fondateur ' + new Date().toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' });
const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: nom, issuer: 'WiTracEQUIP' });
if(error) throw error;
mfaEnCours = { id: data.id };
mfaEcran(`
<form data-mfa-form="verifier" novalidate>
<div class="dlg-titre">Scannez ce QR code</div>
<div class="dlg-corps">1. Ouvrez votre application d'authentification (1Password, Authy, Google Authenticator, Microsoft Authenticator…).<br>2. Ajoutez un compte en scannant ce QR code.<br>3. Saisissez ci-dessous le code à 6 chiffres affiché.</div>
<img class="mfa-qr" src="${esc(data.totp.qr_code)}" alt="QR code à scanner avec votre application d'authentification">
<div class="dlg-corps">Impossible de scanner ? Saisissez cette clé à la main :</div>
<code class="mfa-secret">${esc(data.totp.secret)}</code>
<label class="dlg-champ"><span>Code à 6 chiffres</span>
<input type="text" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="one-time-code" spellcheck="false" placeholder="123456" style="letter-spacing:.3em; font-size:20px; text-align:center;"></label>
<div class="dlg-erreur" hidden></div>
<div class="dlg-actions">
<button type="button" class="btn" data-mfa="annuler">Annuler</button>
<button type="submit" class="btn btn-primary">Valider</button>
</div>
</form>`);
}catch(e){
mfaEcran(`<div class="dlg-titre">Double authentification</div><div class="dlg-erreur">${esc(messageMfa(e))}</div>
<div class="dlg-actions"><button type="button" class="btn" data-mfa="fermer">Fermer</button></div>`);
}
}

async function mfaVerifierEnrolement(form){
if(!mfaEnCours) return;
const erreur = form.querySelector('.dlg-erreur');
const code = String(form.elements.code.value || '').replace(/\s/g, '');
if(!/^\d{6}$/.test(code)){ erreur.textContent = "Saisissez les 6 chiffres affichés par votre application."; erreur.hidden = false; return; }
const bouton = form.querySelector('[type="submit"]'); bouton.disabled = true; erreur.hidden = true;
try{
const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: mfaEnCours.id, code });
if(error) throw error;
mfaEnCours = null; // validé : on ne le retire plus à la fermeture
toast('Double authentification activée.');
mfaEcranListe(await mfaListerActifs());
}catch(e){
erreur.textContent = messageMfa(e); erreur.hidden = false; bouton.disabled = false;
}
}

async function mfaRetirer(id){
if(!await confirmer("Retirer cet appareil ?\n\nSi c'est le dernier, la double authentification sera désactivée et votre compte ne sera plus protégé que par le mot de passe.", { danger:true, ok:'Retirer' })){ ouvrirMfaFondateur(true); return; }
try{
const { error } = await sb.auth.mfa.unenroll({ factorId: id });
if(error) throw error;
toast('Appareil retiré.');
}catch(e){ toast(messageMfa(e), 'erreur'); }
ouvrirMfaFondateur(true);
}

async function ouvrirMfaFondateur(dejaOuvert){
if(!isSuperAdmin() || !state.session) return;
if(state.horsLigne || !navigator.onLine){ toast('Connexion requise pour gérer la double authentification.', 'info'); return; }
if(!dejaOuvert || !mfaPanneau){
if(dialogueOuvert) dialogueOuvert.fermer(null);
const fond = document.createElement('div');
fond.className = 'dlg-fond';
fond.innerHTML = `<div class="dlg dlg-form mfa-panneau" role="dialog" aria-modal="true"><div class="dlg-titre">Double authentification</div><div class="dlg-corps">Chargement…</div></div>`;
document.body.appendChild(fond);
mfaPanneau = fond;
dialogueOuvert = { fermer: () => mfaPanneauFermer(), mfa: true };
document.addEventListener('keydown', mfaClavier, true);
fond.addEventListener('click', (e) => {
const b = e.target.closest('[data-mfa]');
if(!b){ if(e.target === fond) mfaPanneauFermer(); return; }
const a = b.dataset.mfa;
if(a === 'fermer' || a === 'annuler') mfaPanneauFermer();
else if(a === 'commencer') mfaCommencer();
else if(a === 'retirer') mfaRetirer(b.dataset.id);
});
fond.addEventListener('submit', (e) => {
if(e.target.dataset.mfaForm === 'verifier'){ e.preventDefault(); mfaVerifierEnrolement(e.target); }
});
requestAnimationFrame(() => fond.classList.add('visible'));
}
try{ mfaEcranListe(await mfaListerActifs()); }
catch(e){ mfaEcran(`<div class="dlg-titre">Double authentification</div><div class="dlg-erreur">${esc(messageMfa(e))}</div><div class="dlg-actions"><button type="button" class="btn" data-mfa="fermer">Fermer</button></div>`); }
}

/* ---------- Événements ---------- */

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-action="fondateur-mfa"]');
if(!t) return;
if(typeof fermerCommandesFondateur === 'function') fermerCommandesFondateur();
ouvrirMfaFondateur();
});

document.addEventListener('submit', (e) => {
const t = e.target.closest('[data-action="submit-mfa-defi"]');
if(!t) return;
e.preventDefault();
mfaValiderDefi(t);
});
