/* Render root */
/* ---------------------------------------------------------------------- */

/* Clé de la page affichée : l'animation d'arrivée ne se joue qu'en changeant
de page, pas à chaque petit réaffichage (sinon tout clignoterait). */
let dernierePage = null;

function render(){
const focus = capturerFocus();
peindre();
const page = location.hash + '|' + !!state.session;
const main = document.querySelector('#app main');
if(main && page !== dernierePage){
main.classList.remove('entree'); void main.offsetWidth; main.classList.add('entree');
if(dernierePage !== null) window.scrollTo({ top: 0, behavior: 'instant' });
}
dernierePage = page;
restaurerFocus(focus);
}

function peindre(){
const app = document.getElementById('app');
document.body.dataset.role = state.route.name === 'p' ? '' : roleTheme();
if(state.loading){
app.innerHTML = `<div class="center-screen demarrage"><img src="${LOGO_DATA_URL}" alt=""><div class="spinner"></div></div>`;
return;
}
// Consultation publique : l'adresse portée par le QR code collé sur
// l'équipement. Aucun compte, aucune inscription — un contrôleur, un
// inspecteur ou un assureur scanne et lit le carnet. En lecture seule :
// rien de modifiable, et la base reste fermée (une seule fonction est
// ouverte au visiteur, elle ne renvoie que CET équipement).
if(state.route.name === 'p' && state.route.param){
app.innerHTML = renderRoutePublique(state.route.param);
return;
}
if(state.accessError){
app.innerHTML = renderAccesSuspendu();
return;
}
if(!state.session){
// Lien d'invitation : accessible sans être connecté.
if(state.route.name === 'join' && state.route.param){
app.innerHTML = renderJoin(state.route.param);
return;
}
// Étiquettes imprimées avant la mise en place du lien public : elles
// portent l'adresse interne de la fiche. Un visiteur qui les scanne
// obtient la même consultation en lecture seule, pas un écran de
// connexion. L'administrateur peut couper ces anciens liens équipement
// par équipement avec « Changer le lien ».
if(state.route.name === 'equip' && state.route.param){
app.innerHTML = viewFichePublique(state.route.param);
return;
}
app.innerHTML = renderAuth();
return;
}
app.innerHTML = renderShell();
}

/* ---------------------------------------------------------------------- */
/* Numero de serie deja enregistre : on previent, on ne bloque pas */
/* ---------------------------------------------------------------------- */

/* Deux camions peuvent legitimement porter le meme numero de chassis partiel,
et un operateur presse ne doit jamais se retrouver coince par une machine.
On signale donc le doublon sans empecher l'enregistrement.
Volontairement sans render() : reafficher la vue effacerait la saisie en
cours. On ecrit directement dans la zone d'alerte. */
let serieTimer = null;
let serieDemande = 0;

function zoneAlerteSerie(){ return document.getElementById('alerte-serie'); }

function afficherAlerteSerie(html){
const zone = zoneAlerteSerie();
if(!zone) return;
zone.innerHTML = html || '';
zone.classList.toggle('vide', !html);
}

function verifierSerie(valeur, excludeId){
const v = (valeur || '').trim();
clearTimeout(serieTimer);

if(v.length < 3){ afficherAlerteSerie(''); return; }

const demande = ++serieDemande;
serieTimer = setTimeout(async () => {
try{
let q = sb.from('equipements')
.select('id, nom, archived, type_id')
.eq('serial_value', v)
.limit(4);
if(excludeId) q = q.neq('id', excludeId);
const { data, error } = await q;
if(error) throw error;
if(demande !== serieDemande) return; // la saisie a continué entre-temps

const trouves = data || [];
if(!trouves.length){ afficherAlerteSerie(''); return; }

const lignes = trouves.map(e => {
const t = state.types.find(x => x.id === e.type_id);
return `<div>• <a href="#/equip/${e.id}">${esc(e.nom)}</a>`
+ `${t ? ' — ' + esc(t.nom) : ''}`
+ `${e.archived ? ' <em>(retiré du service)</em>' : ''}</div>`;
}).join('');

afficherAlerteSerie(
`<strong>Ce numéro est déjà enregistré</strong>${trouves.length > 1 ? ` (${trouves.length} fiches)` : ''} :`
+ lignes
+ `<div style="margin-top:4px;">Vous pouvez tout de même enregistrer : ce n'est qu'un avertissement.</div>`
);
}catch(e){
// Une vérification qui échoue ne doit jamais empêcher de saisir.
if(demande === serieDemande) afficherAlerteSerie('');
}
}, 400);
}

/* ---------------------------------------------------------------------- */
/* Consultation publique - lecture seule, sans compte */
/* ---------------------------------------------------------------------- */

let fichePublique = { token:null, data:null, loading:false, error:'' };

/* Le technicien qui scanne une etiquette veut souvent enchainer sur la saisie
de son intervention. On retient l'etiquette qu'il avait sous les yeux pour
le ramener directement sur cette fiche une fois connecte. */
function connexionDepuisScan(){
try{ sessionStorage.setItem('wt_retour_scan', fichePublique.token || state.route.param || ''); }catch(e){}
state.authError = ''; state.authNotice = '';
nav('/connexion');
}

function retourApresConnexion(){
let t = '';
try{ t = sessionStorage.getItem('wt_retour_scan') || ''; sessionStorage.removeItem('wt_retour_scan'); }catch(e){}
if(t){ nav('/p/' + t); state.route = parseHash(); }
}
let resolvePublic = { token:null, busy:false };

/* Une personne déjà connectée qui scanne une étiquette de son parc n'a pas
besoin de la vue publique : on l'emmène sur la fiche complète, où elle peut
saisir l'intervention. Si le jeton ne correspond à rien qu'elle ait le droit
de voir, elle retombe sur la vue publique comme tout le monde. */
function renderRoutePublique(token){
if(!state.session){ return viewFichePublique(token); }

if(resolvePublic.token !== token){
resolvePublic = { token, busy:true };
sb.from('equipements').select('id').eq('public_token', token).maybeSingle()
.then(({ data }) => {
if(data && data.id){ nav('/equip/' + data.id); return; }
resolvePublic.busy = false; render();
})
.catch(() => { resolvePublic.busy = false; render(); });
}
if(resolvePublic.busy) return `<div class="center-screen"><div class="spinner"></div></div>`;
return viewFichePublique(token);
}

function viewFichePublique(token){
if(fichePublique.token !== token){
fichePublique = { token, data:null, loading:true, error:'' };
sb.rpc('fiche_publique', { p_token: token })
.then(({ data, error }) => {
if(error) throw error;
fichePublique.data = data || null;
fichePublique.loading = false; render();
})
.catch(e => {
fichePublique.error = (e && e.message) ? e.message : String(e);
fichePublique.loading = false; render();
});
}

if(fichePublique.loading) return `<div class="center-screen"><div class="spinner"></div></div>`;

if(fichePublique.error || !fichePublique.data){
return `
<div class="pub-page">
${enTetePublique('')}
<div class="card stack">
<h2 class="pub-titre">Fiche indisponible</h2>
<div class="small muted">
Cette étiquette ne correspond à aucune fiche consultable. Elle a pu être
remplacée, ou la consultation publique a été fermée par le propriétaire
de l'équipement.
</div>
</div>
${piedPublic()}
</div>`;
}

const d = fichePublique.data;
const champs = Array.isArray(d.champs) ? d.champs : [];
const valeurs = d.valeurs || {};
const ivs = Array.isArray(d.interventions) ? d.interventions : [];

const infoRows = champs.map(c => {
const brut = valeurs[c.key];
const val = !brut ? '—' : (c.type === 'date' ? fmtDate(brut) : brut);
return `<tr><td class="muted">${esc(c.label)}</td><td>${esc(val)}</td></tr>`;
}).join('');

const ivRows = ivs.map(iv => `
<tr>
<td class="iv-date">${fmtDate(iv.date)}</td>
<td data-l="Type">${esc(iv.type)}</td>
<td data-l="Technicien">${esc(iv.technicien)}</td>
<td class="muted" data-l="Description">${esc(iv.description || '—')}</td>
</tr>
`).join('');

const derniere = ivs.length ? fmtDate(ivs[0].date) : null;

return `
<div class="pub-page">
${enTetePublique(d.organisation || '')}

<div class="card stack">
<div>
<h2 class="pub-titre">${esc(d.nom || '')}</h2>
<div class="small muted">
${esc(d.type || '')}${d.serial_value ? ' · ' + esc(d.serial_value) : ''}
</div>
</div>
<div>
<span class="pub-lecture">🔒 Consultation en lecture seule</span>
${d.archived ? `<span class="pub-lecture pub-retire">⚠️ Retiré du service</span>` : ''}
</div>
</div>

<div class="card" style="margin-top:14px;">
<h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">Informations</h3>
<div style="overflow-x:auto;">
<table>
<tr><td class="muted">Mise en service du suivi</td><td>${fmtDate(d.created_at)}</td></tr>
${derniere ? `<tr><td class="muted">Dernière intervention</td><td>${derniere}</td></tr>` : ''}
${infoRows}
</table>
</div>
</div>

<div class="card" style="margin-top:14px;">
<h3>Historique des interventions</h3>
${ivs.length ? `
<div style="overflow-x:auto;">
<table class="pub-ivs">
<thead><tr><th>Date</th><th>Type</th><th>Technicien</th><th>Description</th></tr></thead>
<tbody>${ivRows}</tbody>
</table>
</div>
` : `<div class="empty small">Aucune intervention enregistrée à ce jour.</div>`}
</div>

${piedPublic()}
</div>`;
}

function enTetePublique(org){
return `
<div class="pub-entete">
<img src="${LOGO_DATA_URL}" alt="">
<div>
<div class="nom">WiTracEQUIP</div>
<div class="by">Passeport technique d'équipement</div>
</div>
${org ? `<div class="org">${esc(org)}</div>` : ''}
<button class="pub-connexion" data-action="connexion-depuis-scan">Se connecter</button>
</div>`;
}

function piedPublic(){
return `
<div class="pub-pied">
Carnet d'entretien tenu avec WiTracEQUIP — by WiDIAG MQ.<br>
Cette page est une consultation libre : elle ne permet aucune modification.<br>
Technicien de l'équipe ? « Se connecter » en haut de page ouvre la fiche complète.
</div>
${piedSupport()}`;
}

function renderAccesSuspendu(){
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
${piedSupport()}
</div>
`;
}

/* ---------------------------------------------------------------------- */
/* Rôles : thème de couleur et menus                                       */
/* ---------------------------------------------------------------------- */
/* Chaque rôle a sa couleur : utilisateur bleu, responsable vert, administrateur
   violet, fondateur nuit & or. On sait d'un coup d'œil avec quel profil on est. */
function roleTheme(){
if(!state.session || !state.profile) return '';
if(isSuperAdmin() || state.profile.fondateur) return 'fondateur';
return state.profile.role || '';
}
function libelleRoleTheme(){
if(isSuperAdmin()) return 'Fondateur · WiDIAG MQ';
if(state.profile?.fondateur) return 'Fondateur';
return roleLabel(state.profile?.role);
}

/* Le super-admin travaille client par client : Accueil · Clients · Support · Journal. */
function entreesNav(r){
if(isSuperAdmin()){
const aTraiter = (reglages.support || []).filter(d => d.statut !== 'traite').length;
const sousPage = r.name === 'reglages' ? (r.param || 'clients') : '';
return [
{ path:'/', icone:'home', label:'Accueil', actif: r.name === 'accueil' },
{ path:'/reglages/clients', icone:'briefcase', label:'Clients',
actif: sousPage === 'clients' || ['equip','equip-new','types','equipements','dashboard'].includes(r.name) },
{ path:'/reglages/support', icone:'inbox', label:'Support', actif: sousPage === 'support' || r.name === 'support', badge: aTraiter || '' },
{ path:'/reglages/journal', icone:'journal', label:'Journal', actif: sousPage === 'journal' },
];
}
const equipementsActif = ['dashboard','equipements','equip','equip-new'].includes(r.name);
return [
{ path:'/', icone:'home', label:'Accueil', actif: r.name === 'accueil' },
{ path:'/equipements', icone:'box', label:'Équipements', court:'Équip.', actif: equipementsActif },
...(peutGererTypes() ? [{ path:'/types', icone:'tag', label:"Types d'équipement", court:'Types', actif: r.name === 'types' }] : []),
...(peutReglages() ? [{ path:'/reglages', icone:'gear', label:'Réglages', actif: r.name === 'reglages' || r.name === 'equipe' }] : []),
{ path:'/support', icone:'help', label:'Support', actif: r.name === 'support' },
];
}

/* Super-admin : le parc d'un équipement, c'est la fiche de son client. */
function routeParc(orgId){ return isSuperAdmin() && orgId ? '/reglages/clients/' + orgId : '/equipements'; }
function nomClientDe(orgId){ return ((reglages.clients || []).find(c => c.id === orgId) || {}).nom || ''; }
function typesPour(orgId){ return isSuperAdmin() ? state.types.filter(t => t.organization_id === orgId) : state.types; }
function orgTypesCible(){ return isSuperAdmin() ? state.route.param : state.profile.organization_id; }

async function renommerMoi(){
closeMenus();
const nom = await demander("Modifier mon nom\n\nPrénom et nom, tels qu'ils apparaîtront dans l'application et sur vos prochaines interventions.",
{ ok:'Enregistrer', placeholder:'Prénom Nom', valeur: state.profile?.full_name || '' });
if(nom === null) return;
const propre = nom.trim().replace(/\s+/g, ' ');
if(propre.length < 2){ toast('Indiquez au moins le prénom et le nom.', 'erreur'); return; }
try{
await renommerMembre(state.profile.id, propre);
state.profile.full_name = propre;
const m = (reglages.membres || []).find(x => x.id === state.profile.id);
if(m) m.full_name = propre;
toast('Nom mis à jour');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

function renderShell(){
const r = state.route;
let content = '';
const sa = isSuperAdmin();
try{
if(r.name === 'accueil') content = sa ? viewAccueilFondateur() : viewAccueil();
// Le super-admin n'a pas de parc propre : le parc se consulte client par client.
else if(r.name === 'dashboard' || r.name === 'equipements') content = sa ? viewReglages('clients') : viewDashboard();
else if(r.name === 'types') content = !peutGererTypes() ? viewDashboard() : (sa && !r.param ? viewReglages('clients') : viewTypes());
else if(r.name === 'equip-new') content = viewEquipNew();
else if(r.name === 'equip') content = viewEquipDetail(r.param);
else if(r.name === 'reglages') content = viewReglages(r.param, r.sub);
else if(r.name === 'equipe') content = viewReglages('membres'); // ancienne adresse
else if(r.name === 'support') content = sa ? viewReglages('support') : viewSupport();
else content = sa ? viewReglages('clients') : viewDashboard();
}catch(e){
content = `<div class="alert alert-error">Erreur d'affichage : ${esc(e.message||e)}</div>`;
}


return `
<div class="shell">
<aside class="sidebar">
<div class="sidebar-brand">
<img class="logo" src="assets/icons/icon-192.png" alt="WiTracEQUIP">
<div>
<div class="name">WiTracEQUIP</div>
<div class="by">by WiDIAG MQ</div>
</div>
</div>
<nav class="sidebar-nav">
${entreesNav(r).map(n => `<div class="sidebar-link ${n.actif?'active':''}" data-action="go" data-path="${n.path}">${iconeNav(n.icone)}<span>${n.label}</span>${n.badge ? `<span class="nav-badge">${n.badge}</span>` : ''}</div>`).join('')}
</nav>
<div class="sidebar-spacer"></div>
${sa ? `<div class="sidebar-fondateur">${iconeNav('crown', 16)}<div><strong>Espace fondateur</strong><span>${esc(state.orgName || 'WiDIAG MQ')}</span></div></div>` : ''}
${state.enAttenteCount > 0 ? `<div class="sidebar-sync" title="${state.enAttenteCount} intervention${state.enAttenteCount>1?'s':''} en attente d'envoi (sans réseau)">${iconeNav('clock',15)}<span>${state.enAttenteCount} en attente</span></div>` : ''}
</aside>

<div class="shell-main">
<div class="topbar">
<div class="brand">
<img class="logo" src="assets/icons/icon-192.png" alt="WiTracEQUIP">
<div>
WiTracEQUIP
<div class="by">by WiDIAG MQ</div>
</div>
</div>
<div class="topbar-spacer"></div>
${state.enAttenteCount > 0 ? `<span class="badge-attente" title="${state.enAttenteCount} intervention${state.enAttenteCount>1?'s':''} en attente d'envoi (sans réseau)">⏳ ${state.enAttenteCount}</span>` : ''}
<div class="org-pill">${esc(state.orgName || '…')}</div>
<div class="user-menu">
<button class="user-btn" data-action="toggle-menu">
<span class="avatar">${esc(initials(state.profile?.full_name || state.session.user.email))}</span>
<span class="user-nom">${esc((state.profile?.full_name || '').trim() || state.session.user.email)}</span>
</button>
<div class="dropdown" id="user-dropdown">
<div class="dropdown-entete">
<div class="dropdown-nom">${esc(state.profile?.full_name || 'Sans nom')}</div>
<div class="small muted">${esc(state.session.user.email)}</div>
<div style="margin-top:6px;"><span class="badge badge-role role-${roleTheme()}">${esc(libelleRoleTheme())}</span></div>
</div>
<button data-action="renommer-moi">${iconeNav('pencil', 15)} Modifier mon nom</button>
${sa ? '' : `<button data-action="go" data-path="/support">${iconeNav('help', 15)} Support & réclamations</button>`}
<button data-action="logout" class="dropdown-sortie">Se déconnecter</button>
</div>
</div>
</div>
<main>${content}${piedSupport()}</main>
</div>
${renderModal()}

<nav class="bottom-nav">
${entreesNav(r).map(n => `<div class="bottom-nav-item ${n.actif?'active':''}" data-action="go" data-path="${n.path}">${iconeNav(n.icone,20)}<span>${n.court || n.label}</span>${n.badge ? `<span class="nav-badge">${n.badge}</span>` : ''}</div>`).join('')}
</nav>
</div>
`;
}

/* ---------------------------------------------------------------------- */
/* Auth view */
/* ---------------------------------------------------------------------- */

function renderAuth(){
// L'inscription libre n'existe pas : un compte ne peut être créé qu'en
// ouvrant un lien d'invitation (#/join/...). Cet écran ne sert qu'à se connecter.
return `
<div class="auth-wrap">
<div class="auth-logo">
<img class="logo brand-logo" src="${LOGO_DATA_URL}" alt="WiTracEQUIP">
<h1 style="font-size:20px;">WiTracEQUIP</h1>
<div class="small muted">Le passeport technique de vos équipements — by WiDIAG MQ</div>
</div>

${state.authError ? `<div class="alert alert-error">${esc(state.authError)}</div>` : ''}
${state.authNotice ? `<div class="alert alert-success">${esc(state.authNotice)}</div>` : ''}

<form class="card stack" data-action="submit-auth">
<div class="field">
<label>Email</label>
<input type="email" name="email" placeholder="vous@exemple.com" required autocomplete="email">
</div>
<div class="field">
<label>Mot de passe</label>
${champMotDePasse('current-password')}
</div>
<button class="btn btn-primary btn-block" type="submit" ${state.authBusy?'disabled':''}>
${state.authBusy ? '…' : 'Se connecter'}
</button>
</form>

<div class="small muted" style="text-align:center;margin-top:14px;">
L'accès à WiTracEQUIP se fait uniquement sur invitation.<br>
Vous avez reçu un lien d'invitation ? Ouvrez-le pour créer votre compte.
</div>
${piedSupport()}
</div>
`;
}

async function handleAuthSubmit(form){
state.authError = ''; state.authNotice = ''; state.authBusy = true; render();
const fd = new FormData(form);
const email = fd.get('email').trim();
const password = fd.get('password');
try{
const { error } = await sb.auth.signInWithPassword({ email, password });
if(error) throw error;
// onAuthStateChange se charge de la suite
}catch(e){
state.authError = translateAuthError(e.message || String(e));
}finally{
state.authBusy = false; render();
}
}

function translateAuthError(msg){
const m = msg.toLowerCase();
if(m.includes('invalid login credentials')) return "Email ou mot de passe incorrect.";
if(m.includes('user already registered') || m.includes('already registered')) return "Un compte existe déjà avec cet email.";
if(m.includes('email not confirmed')) return "Merci de confirmer votre email avant de vous connecter (lien envoyé par email).";
if(m.includes('password should be at least')) return "Le mot de passe doit faire au moins 6 caractères.";
if(m.includes('inscription_sur_invitation'))
return "La création de compte se fait uniquement via un lien d'invitation.";
if(m.includes('organisation_suspendue'))
return "L'organisation qui vous invite est actuellement suspendue. Contactez WiDIAG MQ.";
if(m.includes('invite_invalide') || m.includes('database error saving new user'))
return "Ce lien d'invitation n'est plus valable. Demandez-en un nouveau à votre administrateur.";
return msg;
}

/* ---------------------------------------------------------------------- */
/* View: Accueil */
/* ---------------------------------------------------------------------- */

let accueilCache = { chiffres: null, loading: false, error: '' };

async function chargerChiffres(){
const [eq, iv] = await Promise.all([
sb.from('equipements').select('id, archived'),
sb.from('interventions').select('date').order('date', { ascending: false }),
]);
if(eq.error) throw eq.error;
if(iv.error) throw iv.error;
const equipements = eq.data || [];
const interventions = iv.data || [];
return {
actifs: equipements.filter(e => !e.archived).length,
interventions: interventions.length,
derniere: interventions.length ? interventions[0].date : null,
};
}

/* ---------------------------------------------------------------------- */
/* Accueil du fondateur (super-admin) : tableau de bord de l'activité      */
/* ---------------------------------------------------------------------- */
/* Pas de parc propre : on montre ce qui fait la journée d'un prestataire —
   ses clients, ce qui arrive à échéance chez eux, les demandes à traiter. */
let fondateurCache = { donnees:null, loading:false, error:'' };

/* Champs date qui annoncent une échéance : « Prochain(e) … », « Péremption … ». */
function estChampEcheance(c){
return c.type === 'date' && /^(prochain|prochaine|peremption)/.test(c.key || '');
}

async function chargerTableauFondateur(){
const debutMois = new Date(); debutMois.setDate(1);
const iso = `${debutMois.getFullYear()}-${String(debutMois.getMonth() + 1).padStart(2, '0')}-01`;
const [eq, iv] = await Promise.all([
sb.from('equipements').select('id, nom, organization_id, type_id, valeurs').eq('archived', false),
sb.from('interventions').select('id').gte('date', iso),
]);
if(eq.error) throw eq.error;
if(iv.error) throw iv.error;
const aujourdHui = new Date(); aujourdHui.setHours(0, 0, 0, 0);
const limite = new Date(aujourdHui); limite.setDate(limite.getDate() + 45);
const echeances = [];
for(const e of eq.data || []){
const type = state.types.find(t => t.id === e.type_id);
for(const c of (type?.champs || []).filter(estChampEcheance)){
const v = e.valeurs?.[c.key];
const m = typeof v === 'string' && v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if(!m) continue;
const d = new Date(+m[1], +m[2] - 1, +m[3]);
if(d <= limite) echeances.push({ equip:e, libelle:c.label, date:v, jours: Math.round((d - aujourdHui) / 86400000) });
}
}
echeances.sort((a, b) => a.jours - b.jours);
return { interventionsMois: (iv.data || []).length, echeances };
}

function viewAccueilFondateur(){
chargerClients(false);
chargerSupport(false);
if(fondateurCache.donnees === null && !fondateurCache.loading && state.typesLoaded){
fondateurCache.loading = true;
chargerTableauFondateur()
.then(d => { fondateurCache.donnees = d; fondateurCache.error = ''; })
.catch(e => { fondateurCache.error = e.message; })
.finally(() => { fondateurCache.loading = false; render(); });
}
const prenom = (state.profile?.full_name || '').trim().split(/\s+/)[0] || '';
const clients = (reglages.clients || []).filter(c => !c.est_mon_organisation);
const parc = clients.reduce((n, c) => n + (c.nb_equipements || 0), 0);
const aTraiter = (reglages.support || []).filter(d => d.statut !== 'traite').length;
const d = fondateurCache.donnees;
const heure = new Date().getHours();
const salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';
const dateJour = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
const chiffre = (v) => v === null || v === undefined ? '<span class="sq sq-ligne" style="width:40px;display:inline-block;"></span>' : v;

if(scannerState.ouvert) setTimeout(() => attacherScanner(), 0);

const echeances = d ? d.echeances.slice(0, 8) : null;
const nbRetard = d ? d.echeances.filter(x => x.jours < 0).length : 0;

return `
<div class="hero-fondateur">
<div class="hero-fondateur-haut">
<div>
<div class="hero-date">${esc(dateJour)}</div>
<div class="hero-titre">${salut}${prenom ? ', ' + esc(prenom) : ''}</div>
<div class="hero-sous">${iconeNav('crown', 14)} Fondateur · ${esc(state.orgName || 'WiDIAG MQ')}</div>
</div>
<img src="${LOGO_DATA_URL}" alt="" class="hero-logo">
</div>
<div class="kpis">
<div class="kpi" data-action="go" data-path="/reglages/clients"><div class="kpi-val">${chiffre(reglages.clients ? clients.length : null)}</div><div class="kpi-lib">Clients</div></div>
<div class="kpi" data-action="go" data-path="/reglages/clients"><div class="kpi-val">${chiffre(reglages.clients ? parc : null)}</div><div class="kpi-lib">Équipements suivis</div></div>
<div class="kpi"><div class="kpi-val">${chiffre(d ? d.interventionsMois : null)}</div><div class="kpi-lib">Interventions ce mois</div></div>
<div class="kpi ${aTraiter ? 'kpi-alerte' : ''}" data-action="go" data-path="/reglages/support"><div class="kpi-val">${chiffre(reglages.support ? aTraiter : null)}</div><div class="kpi-lib">Demandes à traiter</div></div>
</div>
</div>

<div class="accueil-deux">
<div class="card">
<div class="row between wrap"><h3 style="margin:0;">À prévoir chez vos clients</h3>
${nbRetard ? `<span class="badge badge-off">${nbRetard} en retard</span>` : ''}</div>
<div class="hint" style="margin:2px 0 8px;">Échéances des 45 prochains jours : contrôles, révisions, péremptions.</div>
${fondateurCache.error ? `<div class="alert alert-error">${esc(fondateurCache.error)}</div>`
: echeances === null ? squeletteListe(4).replace('card liste-select', 'liste-select')
: echeances.length ? echeances.map(x => `
<div class="ligne-select cliquable" data-action="go" data-path="/equip/${x.equip.id}">
<div class="echeance-pastille ${x.jours < 0 ? 'retard' : x.jours <= 15 ? 'proche' : ''}">${x.jours < 0 ? 'retard' : x.jours === 0 ? "auj." : x.jours + ' j'}</div>
<div class="ligne-corps">
<div class="ligne-titre">${esc(x.equip.nom)}</div>
<div class="small muted">${esc(nomClientDe(x.equip.organization_id))} · ${esc(x.libelle)} : ${fmtDate(x.date)}</div>
</div>
<span class="chevron">›</span>
</div>`).join('') + (d.echeances.length > 8 ? `<div class="small muted" style="padding-top:8px;">+ ${d.echeances.length - 8} autre(s) échéance(s)</div>` : '')
: `<div class="empty small">Rien d'urgent : aucune échéance dans les 45 jours. 👌</div>`}
</div>

<div class="card">
<div class="row between wrap"><h3 style="margin:0;">Vos clients</h3>
<button class="btn btn-sm" data-action="go" data-path="/reglages/clients">Tous les clients</button></div>
<div style="margin-top:8px;">
${reglages.clients === null ? squeletteListe(4).replace('card liste-select', 'liste-select')
: clients.length ? [...clients].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6).map(c => `
<div class="ligne-select cliquable" data-action="go" data-path="/reglages/clients/${c.id}">
<div class="avatar-client" style="--teinte:${teinteClient(c.nom)};">${esc(initials(c.nom))}</div>
<div class="ligne-corps">
<div class="ligne-titre">${esc(c.nom)}</div>
<div class="small muted">N° ${esc(c.code_client)} · ${c.nb_equipements} équipement${c.nb_equipements > 1 ? 's' : ''}</div>
</div>
<span class="chevron">›</span>
</div>`).join('')
: `<div class="empty small">Aucun client. <a href="#/reglages/clients">Créer le premier</a></div>`}
</div>
</div>
</div>

<div class="scanner-carte">
<div class="scanner-carte-icone">${iconeNav('scan', 26)}</div>
<div class="scanner-carte-texte">
<div class="scanner-carte-titre">Sur le terrain</div>
<p>Scannez l'étiquette d'un équipement chez n'importe lequel de vos clients : sa fiche s'ouvre directement.</p>
</div>
<button class="btn btn-primary" data-action="ouvrir-scanner">Scanner un QR code</button>
</div>
${scannerState.ouvert ? renderScannerOverlay() : ''}
`;
}

function viewAccueil(){
if(accueilCache.chiffres === null && !accueilCache.loading){
accueilCache.loading = true;
chargerChiffres()
.then(c => { accueilCache.chiffres = c; accueilCache.loading = false; render(); })
.catch(e => { accueilCache.error = e.message; accueilCache.loading = false; render(); });
}

const prenom = (state.profile?.full_name || '').trim().split(/\s+/)[0] || '';
const c = accueilCache.chiffres;
const parcVide = c && c.actifs === 0;

const etapes = [
{ n:'1', titre:'Créer',
texte:"Ajoutez un équipement et renseignez sa fiche. Son QR code est généré automatiquement.",
lien:'/equip-new', bouton:'Ajouter un équipement' },
{ n:'2', titre:'Renseigner',
texte:"À chaque passage, scannez le QR code et consignez l'intervention : date, nature, intervenant.",
lien:'/equipements', bouton:'Voir le parc' },
{ n:'3', titre:'Imprimer',
texte:"Imprimez l'étiquette et collez-la sur l'équipement. Le carnet est accessible en deux secondes.",
lien:'/equipements', bouton:'Voir le parc' },
];

// Le <video> est recréé à chaque rendu (innerHTML) : on rattache le flux
// existant et on (re)démarre la boucle de décodage juste après, comme le
// drawQr() de la fiche équipement plus bas dans ce fichier.
if(scannerState.ouvert) setTimeout(() => attacherScanner(), 0);

return `
<div class="accueil-hero">
<div class="accueil-marque">
<img src="${LOGO_DATA_URL}" alt="">
<div>
<div class="accueil-titre">Bienvenue${prenom ? ', ' + esc(prenom) : ''}</div>
<div class="accueil-org">${esc(state.orgName || '')}</div>
</div>
</div>
<p class="accueil-phrase">
Merci d'avoir choisi WiTracEQUIP pour suivre vos équipements. Chaque machine,
véhicule ou appareil porte désormais son carnet d'entretien complet —
consultable et à jour, sur un simple scan.
</p>
</div>

<div class="accueil-section-titre">Votre solution en trois étapes</div>
<div class="etapes-accueil">
${etapes.map((e, i) => `
<div class="etape-accueil ${(parcVide && i === 0) ? 'mise-en-avant' : ''}">
<div class="etape-num">${e.n}</div>
<div class="etape-titre">${e.titre}</div>
<p>${e.texte}</p>
<button class="btn btn-sm ${(parcVide && i === 0) ? 'btn-primary' : ''}"
data-action="go" data-path="${e.lien}">${e.bouton}</button>
</div>`).join('')}
</div>

${accueilCache.error
? `<div class="alert alert-error" style="margin-top:14px;">${esc(accueilCache.error)}</div>` : ''}

<div class="scanner-carte">
<div class="scanner-carte-icone">${iconeNav('scan', 26)}</div>
<div class="scanner-carte-texte">
<div class="scanner-carte-titre">Scanner un équipement</div>
<p>Ouvrez la caméra et cadrez le QR code collé sur l'équipement pour accéder directement à sa fiche — sans passer par l'appareil photo du téléphone.</p>
</div>
<button class="btn btn-primary" data-action="ouvrir-scanner">Scanner un QR code</button>
</div>

${parcVide ? `
<div class="alert alert-info" style="margin-top:14px;">
Votre parc est encore vide. ${peutGererTypes()
? `Commencez par créer un type d'équipement — ou partez d'un <strong>modèle métier</strong> pour tout créer d'un coup.`
: `Votre administrateur doit d'abord créer les types d'équipement.`}
</div>` : ''}

${scannerState.ouvert ? renderScannerOverlay() : ''}
`;
}

function renderScannerOverlay(){
return `
<div class="scanner-overlay">
<video id="scanner-video" playsinline muted autoplay></video>
<canvas id="scanner-canvas"></canvas>
<div class="scanner-cadre"></div>
<button class="scanner-fermer" data-action="fermer-scanner" title="Fermer">✕</button>
<div class="scanner-consigne">Cadrez le QR code de l'équipement</div>
${scannerState.erreur ? `<div class="scanner-erreur">${esc(scannerState.erreur)}</div>` : ''}
</div>`;
}

/* ---------------------------------------------------------------------- */
/* Scanner QR intégré (accueil) — évite d'avoir à ouvrir l'appareil photo du
téléphone à côté de l'appli : la caméra s'ouvre dans un écran plein cadre,
chaque image est décodée avec jsQR, et dès qu'un QR WiTracEQUIP est reconnu
on navigue directement sur la fiche (même logique de routage qu'une étiquette
scannée avec l'appareil photo natif — voir lienPublic() / le hash-routing
plus haut). */
let scannerState = { ouvert:false, busy:false, erreur:'', stream:null, raf:null };

async function ouvrirScanner(){
if(scannerState.ouvert || scannerState.busy) return;

if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
scannerState.ouvert = true;
scannerState.erreur = "Votre navigateur ne permet pas d'utiliser la caméra ici. Scannez l'étiquette avec l'appareil photo du téléphone à la place.";
render();
return;
}

scannerState.busy = true; scannerState.erreur = ''; scannerState.ouvert = true;
render();

try{
const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
scannerState.busy = false;
if(!scannerState.ouvert){ stream.getTracks().forEach(t=>t.stop()); return; } // fermé pendant l'attente
scannerState.stream = stream;
render();
}catch(e){
scannerState.busy = false;
if(!scannerState.ouvert) return;
scannerState.erreur = /NotAllowedError|Permission denied/i.test(e.name || e.message || '')
? "Accès à la caméra refusé. Autorisez la caméra pour WiTracEQUIP dans les réglages de votre navigateur, puis réessayez."
: "Impossible d'accéder à la caméra : " + (e.message || e.name || 'erreur inconnue');
render();
}
}

function fermerScanner(){
if(scannerState.raf) cancelAnimationFrame(scannerState.raf);
scannerState.raf = null;
if(scannerState.stream) scannerState.stream.getTracks().forEach(t=>t.stop());
scannerState.stream = null;
scannerState.ouvert = false;
scannerState.busy = false;
scannerState.erreur = '';
render();
}

// Rattache le flux vidéo (conservé en mémoire) au <video> fraîchement recréé
// par le rendu, et démarre la boucle de décodage si elle ne tourne pas déjà.
// Appelée après chaque rendu de l'accueil tant que le scanner est ouvert —
// même principe que setTimeout(()=>drawQr(...)) sur la fiche équipement.
function attacherScanner(){
if(!scannerState.ouvert || !scannerState.stream) return;

if(typeof jsQR === 'undefined'){
if(!scannerState.erreur){
scannerState.erreur = "Le lecteur de QR code n'a pas pu se charger. Vérifiez votre connexion et réessayez.";
render();
}
return;
}

const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
if(!video || !canvas) return;

if(video.srcObject !== scannerState.stream){
video.srcObject = scannerState.stream;
video.play().catch(()=>{});
}

if(scannerState.raf) return; // la boucle de décodage tourne déjà

const ctx = canvas.getContext('2d', { willReadFrequently:true });

function boucle(){
if(!scannerState.ouvert || !scannerState.stream){ scannerState.raf = null; return; }

if(video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth){
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
let resultat = null;
try{
const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
resultat = jsQR(image.data, image.width, image.height, { inversionAttempts:'dontInvert' });
}catch(e){ /* image illisible, on retente au prochain tour */ }
if(resultat && resultat.data){
scannerState.raf = null;
traiterResultatScan(resultat.data);
return;
}
}
scannerState.raf = requestAnimationFrame(boucle);
}
scannerState.raf = requestAnimationFrame(boucle);
}

// Un QR WiTracEQUIP encode toujours .../#/p/<jeton> (ou plus rarement
// .../#/equip/<id>) — voir lienPublic()/lienEquipement(). On ne garde que
// le fragment de route et on laisse le routage habituel faire le reste
// (même écran que si l'étiquette avait été scannée avec l'appareil photo).
function traiterResultatScan(texte){
const brut = (texte || '').trim();
const idx = brut.indexOf('#');
const chemin = idx !== -1 ? brut.slice(idx + 1) : (/^\/(p|equip)\//.test(brut) ? brut : '');

if(!/^\/(p|equip)\//.test(chemin)){
scannerState.erreur = "Ce QR code ne correspond pas à un équipement WiTracEQUIP.";
render();
setTimeout(() => { if(scannerState.ouvert){ scannerState.erreur = ''; render(); } }, 1800);
return;
}

fermerScanner();
nav(chemin);
}

/* ---------------------------------------------------------------------- */
/* View: Dashboard (équipements) */
/* ---------------------------------------------------------------------- */

/* Un seul modèle d'état initial : la déconnexion le réutilise. (v2.14.2 : la
réinitialisation oubliait `requete`, d'où une boucle de requêtes après
changement de compte — la liste mettait très longtemps à s'afficher.) */
function dashboardInitial(requete){ return { items: null, search:'', typeId:'', showArchived:false, loading:false, error:'', sel:[], perime:false, requete: requete || 0 }; }
let dashboardCache = dashboardInitial();

/* Charge la liste. Pendant un rechargement (recherche, filtre), l'ancienne
liste reste affichée — estompée — au lieu d'un écran vide : pas de saut. */
function chargerEquipements(){
if(dashboardCache.loading) return;
dashboardCache.loading = true;
const n = ++dashboardCache.requete;
// Filet de sécurité : une requête qui ne répond jamais ne doit pas figer la liste.
const delai = new Promise((_, rej) => setTimeout(() => rej(new Error('Le chargement prend trop de temps. Vérifiez la connexion puis réessayez.')), 20000));
Promise.race([listEquipements({ search: dashboardCache.search, typeId: dashboardCache.typeId, showArchived: dashboardCache.showArchived }), delai])
.then(items => {
if(n !== dashboardCache.requete) return;
dashboardCache.items = items; dashboardCache.error = '';
dashboardCache.sel = (dashboardCache.sel || []).filter(id => items.some(e => e.id === id));
})
.catch(e => { if(n === dashboardCache.requete) dashboardCache.error = e.message; })
.finally(() => {
dashboardCache.loading = false;
// Un filtre a changé pendant le chargement : on relance avec les bons critères.
if(dashboardCache.perime){ dashboardCache.perime = false; chargerEquipements(); }
render();
});
}

function viewDashboard(){
if(dashboardCache.items === null && !dashboardCache.loading && !dashboardCache.error) chargerEquipements();

const typeOptions = state.types.map(t => `<option value="${t.id}" ${dashboardCache.typeId===t.id?'selected':''}>${esc(t.nom)}</option>`).join('');

let list = '';
if(dashboardCache.error){
list = `<div class="alert alert-error">${esc(dashboardCache.error)}</div><button class="btn" data-action="dash-recharger">Réessayer</button>`;
} else if(dashboardCache.items === null){
list = squeletteListe(6);
} else if(dashboardCache.items.length === 0){
list = (dashboardCache.search || dashboardCache.typeId)
? `<div class="card empty"><div class="empty-icone">${iconeNav('box', 30)}</div><strong>Aucun résultat</strong><br><span class="small">Aucun équipement ne correspond à « ${esc(dashboardCache.search)} ». Essayez le n° de série ou la plaque.</span></div>`
: `<div class="card empty"><div class="empty-icone">${iconeNav('box', 30)}</div><strong>Aucun équipement pour l'instant</strong><br><span class="small">Ajoutez votre premier équipement pour générer son QR code.</span></div>`;
} else {
const selection = peutSupprimer();
const sel = dashboardCache.sel;
const tousCoches = dashboardCache.items.every(e => sel.includes(e.id));
list = `<div class="card liste-select ${dashboardCache.loading ? 'rafraichit' : ''}">`
+ (selection ? `<label class="tout-selectionner">
<input type="checkbox" data-action="sel-equip-tous" ${tousCoches ? 'checked' : ''}>
<span>Tout sélectionner (${dashboardCache.items.length})</span>
</label>` : '')
+ dashboardCache.items.map(eq => {
const t = state.types.find(t=>t.id===eq.type_id);
const coche = sel.includes(eq.id);
return `
<div class="ligne-select cliquable ${coche ? 'cochee' : ''}">
${selection ? `<input type="checkbox" class="case-sel" data-action="sel-equip" data-id="${eq.id}" ${coche ? 'checked' : ''}>` : ''}
<div class="thumb">${esc(initials(eq.nom))}</div>
<div class="ligne-corps" data-action="go" data-path="/equip/${eq.id}">
<div class="ligne-titre">${esc(eq.nom)} ${eq.archived?'<span class="badge badge-warn">archivé</span>':''}</div>
<div class="small muted">${esc(t?.nom || 'Type inconnu')}${eq.serial_value ? ' · N/S ' + esc(eq.serial_value) : ''}</div>
</div>
<div class="small muted ligne-date">${fmtDate(eq.created_at)}</div>
${isAdmin() ? `<button class="icon-btn btn-poubelle" data-action="suppr-equip-un" data-id="${eq.id}" title="Supprimer définitivement">${iconeNav('trash', 17)}</button>` : ''}
</div>`;
}).join('') + `</div>`;
}

const selItems = (dashboardCache.items || []).filter(e => dashboardCache.sel.includes(e.id));
const barre = (peutSupprimer() && selItems.length) ? `
<div class="barre-selection">
<strong>${selItems.length} sélectionné${selItems.length > 1 ? 's' : ''}</strong>
${selItems.some(e => !e.archived) ? `<button class="btn btn-sm" data-action="equip-archiver-sel">Archiver</button>` : ''}
${selItems.some(e => e.archived) ? `<button class="btn btn-sm" data-action="equip-restaurer-sel">Restaurer</button>` : ''}
${isAdmin() ? `<button class="btn btn-sm btn-danger" data-action="equip-supprimer-sel">Supprimer définitivement</button>` : ''}
<button class="btn btn-sm btn-lien" data-action="equip-desel">Annuler</button>
</div>` : '';

return `
<div class="row between wrap" style="margin-bottom:14px;">
<h2>Équipements</h2>
${state.typesLoaded && state.types.length ? `<button class="btn btn-primary" data-action="go" data-path="/equip-new">+ Nouvel équipement</button>`
: (peutGererTypes() ? `<button class="btn btn-primary" data-action="go" data-path="/types">Créer un type d'équipement d'abord</button>` : '')}
</div>

<div class="card" style="margin-bottom:14px;">
<div class="row wrap" style="gap:10px;">
<input type="search" placeholder="Nom, n° de série ou plaque…" style="flex:2;min-width:180px;" value="${esc(dashboardCache.search)}" data-action="dash-search">
<select style="flex:1;min-width:140px;" data-action="dash-filter-type">
<option value="">Tous les types</option>
${typeOptions}
</select>
<label style="display:flex;align-items:center;gap:6px;text-transform:none;font-weight:500;font-size:13.5px;color:var(--text);margin:0;">
<input type="checkbox" style="width:auto;" ${dashboardCache.showArchived?'checked':''} data-action="dash-archived">
Voir les archivés
</label>
</div>
</div>

${barre}
${list}
`;
}

async function restaurerSelection(){
const ids = (dashboardCache.items || []).filter(e => e.archived && dashboardCache.sel.includes(e.id)).map(e => e.id);
if(!ids.length) return;
if(!await confirmer(`Restaurer ${ids.length > 1 ? 'ces ' + ids.length + ' équipements' : 'cet équipement'} ? ${ids.length > 1 ? 'Ils réapparaîtront' : 'Il réapparaîtra'} dans la liste active.`)) return;
try{
const { error } = await sb.from('equipements')
.update({ archived:false, archived_at:null, archived_by:null, archive_reason:null }).in('id', ids);
if(error) throw error;
apresActionEquipements();
toast(ids.length > 1 ? ids.length + ' équipements restaurés' : 'Équipement restauré');
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

function refreshDashboard(){
dashboardCache.error = '';
accueilCache.chiffres = null; // les compteurs d'accueil se recalculent
fondateurCache.donnees = null;
if(dashboardCache.items === null){ render(); return; }
if(dashboardCache.loading) dashboardCache.perime = true; else chargerEquipements();
render();
}

/* ---------------------------------------------------------------------- */
/* View: Types d'équipement */
/* ---------------------------------------------------------------------- */

let typeForm = { open:false, id:null, nom:'', champs:[], busy:false, error:'' };
let modeleState = { ouvert:false, busy:false };

async function appliquerModele(cle){
const modele = MODELES_METIERS.find(m => m.cle === cle);
if(!modele) return;

// On ne recrée pas ce qui existe déjà : le modèle complète, il n'écrase jamais.
const existants = new Set(typesPour(orgTypesCible()).map(t => (t.nom||'').trim().toLowerCase()));
const aCreer = modele.types.filter(t => !existants.has(t.nom.trim().toLowerCase()));

if(!aCreer.length){
toast('Tous les types de ce modèle sont déjà présents.', 'info');
return;
}

const resume = aCreer.map(t => ' • ' + t.nom).join('\n');
const ignores = modele.types.length - aCreer.length;
if(!await confirmer(
`Ajouter ${aCreer.length} type(s) d'équipement :\n\n${resume}\n\n` +
(ignores ? `${ignores} type(s) déjà présent(s) seront ignorés.\n\n` : '') +
`Vous pourrez ensuite renommer, ajouter ou retirer des champs librement.`)) return;

modeleState.busy = true; render();
try{
const lignes = aCreer.map(t => ({
organization_id: orgTypesCible(),
nom: t.nom,
champs: t.champs.map(c => ({ key: slugify(c.label), label: c.label, type: c.type })),
}));
const { error } = await sb.from('equipment_types').insert(lignes);
if(error) throw error;
await loadTypes(true);
modeleState = { ouvert:false, busy:false };
dashboardCache.items = null; accueilCache.chiffres = null;
render();
}catch(e){
modeleState.busy = false; render();
toast('Erreur : ' + e.message, 'erreur');
}
}

function ouvrirTypeForm(type){
typeForm = type
? { open:true, id:type.id, nom:type.nom,
// On conserve la clé d'origine de chaque champ : c'est elle qui relie
// le champ aux valeurs déjà saisies sur les équipements existants.
champs:(type.champs||[]).map(c => ({ key:c.key, label:c.label, type:c.type })),
busy:false, error:'' }
: { open:true, id:null, nom:'', champs:[], busy:false, error:'' };
render();
// Le formulaire s'affiche en haut de page : on y remonte, sinon il faudrait
// défiler à la main depuis le bas de la liste.
remonterEnHaut();
}

function remonterEnHaut(){
requestAnimationFrame(() => {
window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
const m = document.querySelector('.shell-main');
if(m && m.scrollTop) m.scrollTo({ top: 0, behavior: 'smooth' });
});
}

function viewTypes(){
const cible = orgTypesCible();
const typesVisibles = typesPour(cible);
const rows = typesVisibles.map(t => `
<div class="list-item">
<div class="thumb">${iconeNav('tag', 18)}</div>
<div style="flex:1;min-width:0;">
<div style="font-weight:650;">${esc(t.nom)}</div>
<div class="small muted">${(t.champs||[]).length} champ(s) personnalisé(s)${(t.champs||[]).length ? ' · ' + (t.champs||[]).map(c=>esc(c.label)).join(', ') : ''}</div>
</div>
${peutGererTypes() ? `<button class="btn btn-sm" data-action="edit-type" data-id="${t.id}">Modifier</button>` : ''}
</div>
`).join('');

return `
<div class="row between wrap" style="margin-bottom:14px;">
${isSuperAdmin() ? `<div class="row" style="gap:10px;"><button class="icon-btn" data-action="go" data-path="/reglages/clients/${cible}" title="Retour">←</button><div><h2>Types d'équipement</h2><div class="small muted">chez <strong>${esc(nomClientDe(cible))}</strong></div></div></div>` : `<h2>Types d'équipement</h2>`}
${peutGererTypes()
? `<button class="btn btn-primary" data-action="toggle-type-form">${typeForm.open?'Annuler':'+ Nouveau type'}</button>`
: ''}
</div>

${typeForm.open && peutGererTypes() ? renderTypeForm() : ''}

${(peutGererTypes() && !typeForm.open) ? `
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
${MODELES_METIERS.map(m => `
<div class="modele">
<div class="modele-nom">${esc(m.nom)}</div>
<div class="small muted">${esc(m.description)}</div>
<div class="modele-types">${m.types.map(t => esc(t.nom)).join(' · ')}</div>
<button class="btn btn-sm btn-primary" data-action="appliquer-modele"
data-cle="${m.cle}" ${modeleState.busy?'disabled':''}>
${modeleState.busy ? 'Création…' : `Ajouter ces ${m.types.length} types`}
</button>
</div>`).join('')}
</div>` : ''}
</div>` : ''}

<div class="card" style="padding:0 18px;">
${typesVisibles.length ? rows : `<div class="empty"><div class="empty-icone">${iconeNav('tag', 30)}</div>Aucun type d'équipement.<br><span class="small">${peutGererTypes() ? 'Créez-en un (ex. « Véhicule », « Dispositif médical », « Équipement industriel »…) pour commencer à ajouter des équipements.' : 'Aucun type ne vous a été attribué. Contactez votre administrateur.'}</span></div>`}
</div>
`;
}
function renderTypeForm(){
const champsRows = typeForm.champs.map((c, i) => `
<div class="champ-row">
<input type="text" placeholder="Nom du champ (ex : Kilométrage)" value="${esc(c.label)}" data-action="champ-label" data-i="${i}">
<select data-action="champ-type" data-i="${i}">
${CHAMP_TYPES.map(ct=>`<option value="${ct.v}" ${ct.v===c.type?'selected':''}>${ct.l}</option>`).join('')}
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
<input type="text" placeholder="Ex : Véhicule" id="type-nom-input" value="${esc(typeForm.nom)}" data-action="type-nom">
</div>
<label>Champs personnalisés (optionnel)</label>
<div style="margin-bottom:8px;">${champsRows}</div>
<button type="button" class="btn btn-sm" data-action="champ-add">+ Ajouter un champ</button>
<div class="hint">Ces champs apparaîtront dans le formulaire d'ajout d'équipement de ce type (ex : marque, modèle, capacité, kilométrage…).</div>
${modification ? `
<div class="hint">
Ajouter un champ est sans risque : les équipements existants l'afficheront, vide,
jusqu'à ce qu'il soit renseigné. Retirer un champ le fait disparaître des fiches
mais n'efface rien : le remettre avec le même nom fait réapparaître les valeurs.
</div>` : ''}
<div class="row wrap" style="margin-top:14px;">
<button class="btn btn-primary" data-action="save-type" ${typeForm.busy?'disabled':''}>${typeForm.busy?'Enregistrement…':(modification ? 'Enregistrer les modifications' : 'Enregistrer le type')}</button>
<button class="btn" type="button" data-action="toggle-type-form">Annuler</button>
</div>
</div>
`;
}

async function saveType(){
typeForm.error = '';
const nom = typeForm.nom.trim();
if(!nom){ typeForm.error = 'Le nom du type est obligatoire.'; render(); return; }
const champs = typeForm.champs
.filter(c => c.label.trim())
// c.key existe déjà pour un champ créé précédemment : on le garde, sinon
// renommer un libellé détacherait le champ des valeurs déjà saisies.
.map(c => ({ key: c.key || slugify(c.label), label: c.label.trim(), type: c.type }));
typeForm.busy = true; render();
try{
if(typeForm.id){
const { error } = await sb.from('equipment_types')
.update({ nom, champs }).eq('id', typeForm.id);
if(error) throw error;
} else {
const { error } = await sb.from('equipment_types').insert({
organization_id: orgTypesCible(),
nom, champs
});
if(error) throw error;
}
const modifie = !!typeForm.id;
typeForm = { open:false, id:null, nom:'', champs:[], busy:false, error:'' };
await loadTypes(true);
dashboardCache.items = null; accueilCache.chiffres = null;
toast(modifie ? 'Type modifié' : "Type d'équipement créé");
render();
}catch(e){
typeForm.busy = false; typeForm.error = e.message; render();
}
}

function slugify(s){
return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || ('champ_' + Math.random().toString(36).slice(2,6));
}

/* ---------------------------------------------------------------------- */
/* Gestion des membres et invitations : voir js/reglages.js                */
/* ---------------------------------------------------------------------- */

function viewNonAutorise(){
return `<div class="alert alert-error">Cette section est réservée à l'administrateur.</div>`;
}

/* ---------------------------------------------------------------------- */
/* View: Rejoindre via un lien d'invitation (sans être connecté) */
/* ---------------------------------------------------------------------- */

let joinState = { token:null, loading:false, preview:null, error:'', busy:false, notice:'' };

function renderJoin(token){
if(joinState.token !== token){
joinState = { token, loading:true, preview:null, error:'', busy:false, notice:'' };
sb.rpc('invite_preview', { p_token: token })
.then(({ data, error }) => {
if(error) throw error;
joinState.preview = (data && data[0]) || null;
joinState.loading = false; render();
})
.catch(e => { joinState.error = e.message; joinState.loading = false; render(); });
}

if(joinState.loading) return `<div class="center-screen"><div class="spinner"></div></div>`;

const p = joinState.preview;
const invalide = !p || !p.valid;

return `
<div class="auth-wrap">
<div class="auth-logo">
<img class="logo" src="${LOGO_DATA_URL}" alt="WiTracEQUIP">
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
en tant que <strong>${esc(roleLabel(p.invite_role))}</strong>.`}
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
<button class="btn btn-primary btn-block" type="submit" ${joinState.busy?'disabled':''}>
${joinState.busy ? '…' : 'Créer mon compte'}
</button>
</form>
`}
${piedSupport()}
</div>
`;
}

async function handleJoinSubmit(form){
joinState.error = ''; joinState.notice = ''; joinState.busy = true; render();
const fd = new FormData(form);
try{
const { data, error } = await sb.auth.signUp({
email: fd.get('email').trim(),
password: fd.get('password'),
options: { data: { full_name: fd.get('full_name').trim(), invite_token: joinState.token } }
});
if(error) throw error;
if(!data.session){
joinState.notice = "Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.";
}
}catch(e){
joinState.error = translateAuthError(e.message || String(e));
}finally{
joinState.busy = false; render();
}
}

/* ---------------------------------------------------------------------- */
/* View: Nouvel équipement */
/* ---------------------------------------------------------------------- */

let equipForm = { typeId:'', orgId:'', nom:'', serial_value:'', valeurs:{}, busy:false, error:'' };

function viewEquipNew(){
// Super-admin : l'équipement est créé chez le client d'où l'on vient.
if(isSuperAdmin() && !equipForm.orgId) return viewReglages('clients');
const types = typesPour(equipForm.orgId);
if(!types.some(t => t.id === equipForm.typeId)) equipForm.typeId = types[0]?.id || '';
const type = types.find(t=>t.id===equipForm.typeId);
const champs = type?.champs || [];
const retour = routeParc(equipForm.orgId);

return `
<div class="row" style="margin-bottom:14px;gap:10px;">
<button class="icon-btn" data-action="go" data-path="${retour}" title="Retour">←</button>
<div><h2>Nouvel équipement</h2>${isSuperAdmin() ? `<div class="small muted">chez <strong>${esc(nomClientDe(equipForm.orgId))}</strong></div>` : ''}</div>
</div>
<div class="card">
${equipForm.error ? `<div class="alert alert-error">${esc(equipForm.error)}</div>` : ''}
<div class="grid-2">
<div class="field">
<label>Type d'équipement</label>
<select data-action="equip-type">
${types.map(t=>`<option value="${t.id}" ${t.id===equipForm.typeId?'selected':''}>${esc(t.nom)}</option>`).join('')}
</select>
</div>
<div class="field">
<label>Nom / désignation</label>
<input type="text" placeholder="Ex : Renault Kangoo — WD-12" value="${esc(equipForm.nom)}" data-action="equip-nom">
</div>
</div>
<div class="field">
<label>N° de série / immatriculation (optionnel)</label>
<input type="text" placeholder="Ex : AB-123-CD" value="${esc(equipForm.serial_value)}" data-action="equip-serial">
<div class="alerte-serie vide" id="alerte-serie"></div>
</div>
${champs.length ? `<label style="margin-top:6px;">Informations spécifiques au type</label>` : ''}
<div class="grid-2">
${champs.map(c => `
<div class="field">
<label style="text-transform:none;font-weight:600;color:var(--text);">${esc(c.label)}</label>
${c.type==='textarea'
? `<textarea data-action="equip-valeur" data-key="${c.key}">${esc(equipForm.valeurs[c.key]||'')}</textarea>`
: `<input type="${c.type==='number'?'number':(c.type==='date'?'date':'text')}" value="${esc(equipForm.valeurs[c.key]||'')}" data-action="equip-valeur" data-key="${c.key}">`}
</div>
`).join('')}
</div>
<div class="row" style="margin-top:8px;">
<button class="btn btn-primary" data-action="save-equip" ${equipForm.busy?'disabled':''}>${equipForm.busy?'Enregistrement…':"Créer l'équipement"}</button>
<button class="btn" data-action="go" data-path="${retour}">Annuler</button>
</div>
</div>
`;
}

async function saveEquip(){
equipForm.error = '';
const nom = equipForm.nom.trim();
if(!nom){ equipForm.error = 'Le nom est obligatoire.'; render(); return; }
if(!equipForm.typeId){ equipForm.error = "Choisissez un type d'équipement."; render(); return; }
equipForm.busy = true; render();
try{
const { data, error } = await sb.from('equipements').insert({
organization_id: isSuperAdmin() ? equipForm.orgId : state.profile.organization_id,
type_id: equipForm.typeId,
nom,
serial_value: equipForm.serial_value.trim() || null,
valeurs: equipForm.valeurs,
archived: false
}).select('id').single();
if(error) throw error;
equipForm = { typeId:'', orgId:'', nom:'', serial_value:'', valeurs:{}, busy:false, error:'' };
reglages.parcs = {};
refreshDashboard();
toast('Équipement créé — son QR code est prêt');
nav('/equip/' + data.id);
}catch(e){
equipForm.busy = false; equipForm.error = e.message; render();
}
}

/* ---------------------------------------------------------------------- */
/* View: Détail équipement (QR + historique) */
/* ---------------------------------------------------------------------- */

let equipDetail = { id:null, item:null, interventions:null, loading:false, error:'',
showIvForm:false, ivBusy:false, ivError:'', ivNotice:'',
showEditForm:false, editBusy:false, editError:'',
editIvId:null, editIvBusy:false, editIvError:'' };

function viewEquipDetail(id){
if(isSuperAdmin()) chargerClients(false); // pour afficher le nom du client
if(equipDetail.id !== id){
equipDetail = { id, item:null, interventions:null, loading:true, error:'',
showIvForm:false, ivBusy:false, ivError:'', ivNotice:'',
showEditForm:false, editBusy:false, editError:'',
editIvId:null, editIvBusy:false, editIvError:'' };
Promise.all([getEquipement(id), listInterventions(id)])
.then(([item, ivs]) => {
equipDetail.item = item; equipDetail.interventions = ivs; equipDetail.loading = false; render();
setTimeout(()=>drawQr(lienPublic(item.public_token)), 30);
})
.catch(e => { equipDetail.error = e.message; equipDetail.loading = false; render(); });
}

if(equipDetail.loading) return squeletteFiche((dashboardCache.items || []).find(e => e.id === id)?.nom);
if(equipDetail.error) return `<div class="alert alert-error">${esc(equipDetail.error)}</div>`;
if(!equipDetail.item) return `<div class="empty">Équipement introuvable.</div>`;

const eq = equipDetail.item;
const type = state.types.find(t=>t.id===eq.type_id);
const champs = type?.champs || [];
const url = lienPublic(eq.public_token);

const infoRows = champs.map(c => {
const brut = eq.valeurs?.[c.key];
const val = !brut ? '—' : (c.type === 'date' ? fmtDate(brut) : brut);
return `<tr><td class="muted">${esc(c.label)}</td><td>${esc(val)}</td></tr>`;
}).join('');

const ivRows = (equipDetail.interventions||[]).map(iv => equipDetail.editIvId === iv.id ? `
<tr class="iv-edition"><td colspan="5">${renderIvForm(iv)}</td></tr>` : `
<tr>
<td class="iv-date">${fmtDate(iv.date)}</td>
<td data-l="Type">${esc(iv.type)}</td>
<td data-l="Intervenant">${esc(iv.technicien)}</td>
<td class="muted" data-l="Description">${esc(iv.description||'—')}
${iv.modifie_le ? `<div class="iv-modif">Modifiée le ${fmtDateTime(iv.modifie_le)}${iv.modifie_par ? ' par ' + esc(iv.modifie_par) : ''}</div>` : ''}
</td>
<td class="iv-actions">
<button class="btn btn-sm" data-action="iv-modifier" data-id="${iv.id}">Modifier</button>
${isAdmin() ? `<button class="btn btn-sm btn-danger" data-action="iv-supprimer" data-id="${iv.id}">Supprimer</button>` : ''}
</td>
</tr>
`).join('');

// Le QR est dessiné dans un <canvas> que chaque réaffichage recrée vide.
// On le redessine donc après CHAQUE rendu de la fiche, sinon ouvrir un
// formulaire efface le QR — et « Imprimer l'étiquette » sortirait une étiquette vierge.
setTimeout(() => drawQr(url), 0);

return `
<div class="fiche-entete">
<button class="icon-btn" data-action="go" data-path="${routeParc(eq.organization_id)}" title="Retour">←</button>
<div class="titre">
<h2>${esc(eq.nom)} ${eq.archived?'<span class="badge badge-warn">archivé</span>':''}</h2>
<div class="small muted">${isSuperAdmin() && nomClientDe(eq.organization_id) ? `<a href="#/reglages/clients/${eq.organization_id}">${esc(nomClientDe(eq.organization_id))}</a> · ` : ''}${esc(type?.nom || '')}${eq.serial_value ? ' · N/S ' + esc(eq.serial_value) : ''}</div>
</div>
<div class="actions">
${!eq.archived ? `<button class="btn btn-sm" data-action="toggle-edit-equip">${equipDetail.showEditForm ? 'Annuler' : 'Modifier'}</button>` : ''}
${!eq.archived && peutSupprimer() ? `<button class="btn btn-sm" data-action="archive-equip">Archiver</button>` : ''}
${eq.archived && peutSupprimer() ? `<button class="btn btn-sm" data-action="restore-equip">Restaurer</button>` : ''}
${isAdmin() ? `<button class="btn btn-danger btn-sm" data-action="suppr-equip-un" data-id="${eq.id}">Supprimer</button>` : ''}
</div>
</div>

${equipDetail.showEditForm && !eq.archived ? renderEditEquipForm(eq, champs) : ''}

<div class="grid-2" style="align-items:start;">
<div class="card">
<h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">QR code</h3>
<div class="qr-box">
<canvas id="qr-canvas"></canvas>
<div class="small muted" style="word-break:break-all;text-align:center;">${esc(url)}</div>

<div class="small" style="text-align:center;line-height:1.55;${eq.partage_public ? '' : 'color:var(--text-dim);'}">
${eq.partage_public
? "Toute personne qui scanne cette étiquette lit le carnet d'entretien : contrôleur, inspecteur, assureur, acheteur. Sans compte et sans inscription — et sans rien pouvoir modifier."
: "Consultation publique fermée : scanner l'étiquette ne montre plus rien."}
</div>

${peutSupprimer() ? `
<div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center;">
<button class="btn btn-sm" data-action="toggle-partage">
${eq.partage_public ? 'Fermer la consultation publique' : 'Rouvrir la consultation publique'}
</button>
${isAdmin() ? `<button class="btn btn-sm" data-action="regen-token">Changer le lien</button>` : ''}
</div>` : ''}
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
${eq.archived ? `<tr><td class="muted">Retiré le</td><td>${fmtDateTime(eq.archived_at)}${eq.archived_by ? ' par ' + esc(eq.archived_by) : ''}</td></tr>` : ''}
${eq.archived && eq.archive_reason ? `<tr><td class="muted">Motif du retrait</td><td>${esc(eq.archive_reason)}</td></tr>` : ''}
${infoRows}
</table>
</div>
</div>

<div class="card" style="margin-top:14px;">
<div class="row between">
<h3>Historique des interventions</h3>
<button class="btn btn-sm" data-action="toggle-iv-form">${equipDetail.showIvForm?'Annuler':'+ Ajouter'}</button>
</div>

${equipDetail.showIvForm ? renderIvForm(null) : ''}
${equipDetail.ivNotice ? `<div class="alert alert-info" style="margin-top:10px;">${esc(equipDetail.ivNotice)}</div>` : ''}

${equipDetail.interventions && equipDetail.interventions.length ? `
<div style="overflow-x:auto;">
<table class="table-iv">
<thead><tr><th>Date</th><th>Type</th><th>Intervenant</th><th>Description</th><th></th></tr></thead>
<tbody>${ivRows}</tbody>
</table>
</div>
` : `<div class="empty small">Aucune intervention enregistrée.</div>`}
</div>

`;
}

function renderEditEquipForm(eq, champs){
return `
<form class="card" style="margin-bottom:14px;" data-action="submit-edit-equip">
<h3 class="small" style="text-transform:uppercase;letter-spacing:.02em;color:var(--text-dim);">Modifier la fiche</h3>
${equipDetail.editError ? `<div class="alert alert-error">${esc(equipDetail.editError)}</div>` : ''}
<div class="grid-2">
<div class="field">
<label>Nom / désignation</label>
<input type="text" name="nom" value="${esc(eq.nom || '')}" required>
</div>
<div class="field">
<label>N° de série / immatriculation</label>
<input type="text" name="serial_value" value="${esc(eq.serial_value || '')}"
data-action="edit-serial" data-exclude="${eq.id}">
<div class="alerte-serie vide" id="alerte-serie"></div>
</div>
</div>
${champs.length ? `<label style="margin-top:6px;">Informations spécifiques au type</label>` : ''}
<div class="grid-2">
${champs.map(c => {
const val = eq.valeurs?.[c.key] ?? '';
return `
<div class="field">
<label style="text-transform:none;font-weight:600;color:var(--text);">${esc(c.label)}</label>
${c.type==='textarea'
? `<textarea name="champ__${esc(c.key)}">${esc(val)}</textarea>`
: `<input type="${c.type==='number'?'number':(c.type==='date'?'date':'text')}" name="champ__${esc(c.key)}" value="${esc(val)}">`}
</div>`;
}).join('')}
</div>
<div class="row wrap" style="margin-top:8px;">
<button class="btn btn-primary" type="submit" ${equipDetail.editBusy?'disabled':''}>
${equipDetail.editBusy ? 'Enregistrement…' : 'Enregistrer les modifications'}
</button>
<button class="btn" type="button" data-action="toggle-edit-equip">Annuler</button>
</div>
</form>
`;
}

async function submitEditEquip(form){
const fd = new FormData(form);
const nom = (fd.get('nom') || '').trim();
if(!nom){ equipDetail.editError = 'Le nom est obligatoire.'; render(); return; }
const serial = (fd.get('serial_value') || '').trim();
const valeurs = Object.assign({}, equipDetail.item?.valeurs || {});
for(const [k, v] of fd.entries()){
if(k.startsWith('champ__')) valeurs[k.slice(7)] = v;
}

equipDetail.editError = ''; equipDetail.editBusy = true; render();
try{
const { error } = await sb.from('equipements')
.update({ nom, serial_value: serial || null, valeurs })
.eq('id', equipDetail.id);
if(error) throw error;
equipDetail.item = await getEquipement(equipDetail.id);
equipDetail.showEditForm = false;
refreshDashboard();
toast('Fiche enregistrée');
}catch(e){
equipDetail.editError = e.message;
}finally{
equipDetail.editBusy = false; render();
}
}

async function restoreEquipement(){
if(!await confirmer("Restaurer cet équipement ? Il réapparaîtra dans la liste active.")) return;
try{
const { error } = await sb.from('equipements')
.update({ archived:false, archived_at:null, archived_by:null, archive_reason:null })
.eq('id', equipDetail.id);
if(error) throw error;
equipDetail.item = await getEquipement(equipDetail.id);
dashboardCache.items = null; accueilCache.chiffres = null;
render();
}catch(e){
toast('Erreur : ' + e.message, 'erreur');
}
}

function drawQr(url){
const canvas = document.getElementById('qr-canvas');
if(!canvas || typeof QRious === 'undefined' || !url) return;
new QRious({ element: canvas, value: url, size: 200, background: 'white', foreground: '#141b1e', level: 'M' });
}

function renderIvForm(iv){
// iv fourni = modification d'une intervention existante ; sinon, nouvelle saisie.
// Date du jour en heure LOCALE (toISOString donnerait la date UTC : le lendemain en soirée aux Antilles).
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const modif = !!iv;
const err = modif ? equipDetail.editIvError : equipDetail.ivError;
return `
<form class="card" style="background:var(--surface-2);margin:12px 0;" data-action="${modif ? 'submit-iv-edit' : 'submit-iv'}" ${modif ? `data-id="${iv.id}"` : ''}>
${modif ? `<div style="font-weight:650;margin-bottom:8px;">Modifier l'intervention</div>` : ''}
${err ? `<div class="alert alert-error">${esc(err)}</div>` : ''}
<div class="grid-2">
<div class="field">
<label>Date <span class="oblig">obligatoire</span></label>
<input type="date" name="date" value="${modif ? esc(iv.date) : today}" required>
</div>
<div class="field">
<label>Type d'intervention <span class="oblig">obligatoire</span></label>
<input type="text" name="type" value="${modif ? esc(iv.type) : ''}" placeholder="Ex : Entretien, Réparation, Contrôle…" required>
</div>
</div>
<div class="field">
<label>Intervenant <span class="oblig">obligatoire</span></label>
<input type="text" name="technicien" value="${esc(modif ? iv.technicien : (state.profile?.full_name||''))}" required
placeholder="Nom de la personne intervenue">
<div class="hint">Nom de la personne qui a réalisé l'intervention. C'est lui qui figurera
sur le carnet en cas de contrôle — pré-rempli avec le vôtre, modifiable si vous
saisissez pour un collègue.</div>
</div>
<div class="field"><label>Description</label><textarea name="description" placeholder="Détails de l'intervention…">${modif ? esc(iv.description || '') : ''}</textarea></div>
${modif ? `
<div class="hint" style="margin-bottom:10px;">La modification est horodatée à votre nom et l'ancienne version est conservée dans le journal.</div>
<div class="row wrap">
<button class="btn btn-primary" type="submit" ${equipDetail.editIvBusy?'disabled':''}>${equipDetail.editIvBusy?'Enregistrement…':'Enregistrer les modifications'}</button>
<button class="btn" type="button" data-action="iv-annuler-modif">Annuler</button>
</div>` : `
<button class="btn btn-primary" type="submit" ${equipDetail.ivBusy?'disabled':''}>${equipDetail.ivBusy?'Enregistrement…':"Enregistrer l'intervention"}</button>`}
</form>
`;
}

async function submitIntervention(form){
// On lit et on valide AVANT tout réaffichage : une fiche d'intervention sans
// intervenant ni date n'a aucune valeur de preuve, elle ne doit pas partir.
const fd = new FormData(form);
const date = (fd.get('date') || '').trim();
const type = (fd.get('type') || '').trim();
const technicien = (fd.get('technicien') || '').trim();
const description = (fd.get('description') || '').trim();

if(!date){
equipDetail.ivError = "La date de l'intervention est obligatoire.";
render(); return;
}
if(!type){
equipDetail.ivError = "Le type d'intervention est obligatoire (entretien, réparation, contrôle…).";
render(); return;
}
if(!technicien){
equipDetail.ivError = "Le nom de l'intervenant est obligatoire : c'est lui qui engage la traçabilité de la fiche.";
render(); return;
}

equipDetail.ivError = ''; equipDetail.ivBusy = true; render();

const donneesIv = { equipement_id: equipDetail.id, date, type, technicien, description: description || null };

// Pas de réseau connu : on met en attente directement, inutile de tenter.
if(!navigator.onLine){
await offlineMettreEnAttente(donneesIv);
state.enAttenteCount = await offlineCompterEnAttente();
equipDetail.showIvForm = false;
equipDetail.ivBusy = false;
equipDetail.ivNotice = "Pas de réseau : intervention enregistrée hors-ligne, elle sera envoyée automatiquement dès la reconnexion.";
render();
return;
}

try{
const { error } = await sb.from('interventions').insert(donneesIv);
if(error) throw error;
equipDetail.showIvForm = false;
equipDetail.interventions = await listInterventions(equipDetail.id);
equipDetail.ivBusy = false;
toast('Intervention enregistrée');
render();
}catch(e){
// Le réseau se coupe parfois entre le test navigator.onLine et l'envoi
// réel (sous-sol, ascenseur...) : une vraie erreur réseau (pas une erreur
// métier renvoyée par Supabase/Postgres) bascule aussi en file d'attente
// plutôt que de faire perdre la saisie au technicien.
const messageReseau = /failed to fetch|networkerror|load failed|network request failed/i.test(e.message || '');
if(messageReseau){
await offlineMettreEnAttente(donneesIv);
state.enAttenteCount = await offlineCompterEnAttente();
equipDetail.showIvForm = false;
equipDetail.ivBusy = false;
equipDetail.ivNotice = "Réseau indisponible : intervention enregistrée hors-ligne, elle sera envoyée automatiquement dès la reconnexion.";
render();
return;
}
equipDetail.ivBusy = false; equipDetail.ivError = e.message; render();
}
}

/* Modifier une intervention : ouvert à tous les rôles, mais la date et le nom
de l'intervenant restent obligatoires (la base le vérifie aussi). La base
horodate la modification au nom de l'auteur et garde l'ancienne version au
journal : on peut corriger une saisie, pas effacer une trace. */
async function submitEditIntervention(form){
const id = form.dataset.id;
const fd = new FormData(form);
const date = (fd.get('date') || '').trim();
const type = (fd.get('type') || '').trim();
const technicien = (fd.get('technicien') || '').trim();
const description = (fd.get('description') || '').trim();
if(!date){ equipDetail.editIvError = "La date de l'intervention est obligatoire."; render(); return; }
if(!type){ equipDetail.editIvError = "Le type d'intervention est obligatoire."; render(); return; }
if(!technicien){ equipDetail.editIvError = "Le nom de l'intervenant est obligatoire."; render(); return; }
if(!navigator.onLine){ equipDetail.editIvError = "Pas de réseau : la modification d'une intervention nécessite une connexion."; render(); return; }

equipDetail.editIvError = ''; equipDetail.editIvBusy = true; render();
try{
const { error } = await sb.from('interventions')
.update({ date, type, technicien, description: description || null }).eq('id', id);
if(error) throw error;
equipDetail.interventions = await listInterventions(equipDetail.id);
equipDetail.editIvId = null;
reglages.journal = null;
toast('Intervention modifiée');
}catch(e){
equipDetail.editIvError = e.message;
}finally{
equipDetail.editIvBusy = false; render();
}
}

async function supprimerIntervention(id){
const iv = (equipDetail.interventions || []).find(x => x.id === id);
if(!iv) return;
if(!await confirmer(`Supprimer l'intervention « ${iv.type} » du ${fmtDate(iv.date)} ?\n\nElle disparaît du carnet de cet équipement. Une copie est conservée dans le journal.`)) return;
try{
const { data, error } = await sb.from('interventions').delete().eq('id', id).select('id');
if(error) throw error;
if(!data || !data.length) throw new Error("Suppression refusée : seul un administrateur peut supprimer une intervention.");
equipDetail.interventions = await listInterventions(equipDetail.id);
reglages.journal = null;
accueilCache.chiffres = null;
toast('Intervention supprimée');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* Ouvrir ou fermer la consultation libre d'un equipement. Fermee, l'etiquette
deja collee ne montre plus rien : la fiche redevient interne. */
async function actionTogglePartage(){
const eq = equipDetail.item;
if(!eq) return;
const ouvrir = !eq.partage_public;
if(!ouvrir && !await confirmer("Fermer la consultation publique ? Les étiquettes déjà collées sur cet équipement ne montreront plus rien à ceux qui les scannent.")) return;
try{
const { error } = await sb.from('equipements')
.update({ partage_public: ouvrir }).eq('id', eq.id);
if(error) throw error;
eq.partage_public = ouvrir;
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* Changer le jeton : l'ancienne etiquette devient muette, la fiche et son
historique ne bougent pas. Utile si une etiquette part avec un vehicule vendu.
Passe par la RPC regenerer_public_token (plutôt qu'un update() direct) :
elle revérifie elle-même le rôle et l'organisation côté serveur (indépendamment
du trigger equipements_guard, qui reste une seconde barrière), et renvoie le
nouveau jeton en un seul aller-retour. Le QR affiché est redessiné automatique-
ment au prochain render() (voir le commentaire au-dessus de drawQr plus haut :
il se redessine à chaque rendu de la fiche à partir de eq.public_token). */
async function actionRegenererLienPublic(){
const eq = equipDetail.item;
if(!eq) return;
if(!await confirmer("Changer le lien public ? Toutes les étiquettes déjà imprimées pour cet équipement cesseront de fonctionner : il faudra en réimprimer une. La fiche et son historique sont conservés.")) return;
try{
const { data: nouveauToken, error } = await sb.rpc('regenerer_public_token', { p_equipement_id: eq.id });
if(error) throw error;
eq.public_token = nouveauToken;
eq.ancien_lien_actif = false;
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

function printQr(){
const eq = equipDetail.item;
const printArea = document.getElementById('print-area');
if(!eq || !printArea) return;

const url = lienPublic(eq.public_token);

// QR généré spécialement pour l'impression, en haute définition : une
// imprimante thermique tire à ~203 points par pouce, le QR de 200 px affiché
// à l'écran sortirait baveux et difficile à scanner.
let source = null;
if(typeof QRious !== 'undefined'){
const hd = document.createElement('canvas');
new QRious({ element: hd, value: url, size: 800, background:'white', foreground:'#000000', level:'M' });
source = hd;
} else {
source = document.getElementById('qr-canvas'); // repli
}
if(!source) return;

const ident = (eq.serial_value || '').trim();
const cote = ETIQUETTE.taille_qr_mm;

printArea.innerHTML = `
<img id="print-qr-img" alt="" style="width:${cote}mm;height:${cote}mm;">
${(ETIQUETTE.afficher_identifiant && ident) ? `<div class="etiquette-id">${esc(ident)}</div>` : ''}
`;

const img = document.getElementById('print-qr-img');
// L'image est une donnée encodée : il faut attendre qu'elle soit décodée,
// sinon l'impression part avant et l'étiquette sort vide.
img.onload = () => window.print();
img.onerror = () => window.print();
img.src = source.toDataURL('image/png');
}

/* ---------------------------------------------------------------------- */
/* Event delegation */
/* ---------------------------------------------------------------------- */

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const action = t.dataset.action;

if(action === 'go'){ nav(t.dataset.path); closeMenus(); }
else if(action === 'toggle-menu'){ e.stopPropagation(); document.getElementById('user-dropdown')?.classList.toggle('open'); }
else if(action === 'logout'){ sb.auth.signOut(); }
else if(action === 'dash-recharger'){ dashboardCache.error = ''; dashboardCache.items = null; render(); chargerEquipements(); }
else if(action === 'auth-mode'){ state.authMode = t.dataset.mode; state.authError=''; state.authNotice=''; render(); }
else if(action === 'toggle-type-form'){ typeForm.open ? (typeForm = { open:false, id:null, nom:'', champs:[], busy:false, error:'' }, render()) : ouvrirTypeForm(null); }
else if(action === 'edit-type'){
const type = state.types.find(x => x.id === t.dataset.id);
if(type) ouvrirTypeForm(type);
}
else if(action === 'champ-add'){ typeForm.champs.push({label:'', type:'text'}); render(); }
else if(action === 'champ-remove'){ typeForm.champs.splice(+t.dataset.i, 1); render(); }
else if(action === 'save-type'){ saveType(); }
else if(action === 'save-equip'){ saveEquip(); }
else if(action === 'toggle-iv-form'){ equipDetail.showIvForm = !equipDetail.showIvForm; equipDetail.editIvId = null; equipDetail.ivNotice = ''; render(); }
else if(action === 'archive-equip'){ ouvrirModalArchiver([equipDetail.id]); }
else if(action === 'suppr-equip-un'){ ouvrirModalSupprimerEquip([t.dataset.id]); }
else if(action === 'equip-archiver-sel'){ ouvrirModalArchiver((dashboardCache.items||[]).filter(e => !e.archived && dashboardCache.sel.includes(e.id)).map(e => e.id)); }
else if(action === 'equip-supprimer-sel'){ ouvrirModalSupprimerEquip([...dashboardCache.sel]); }
else if(action === 'equip-restaurer-sel'){ restaurerSelection(); }
else if(action === 'equip-desel'){ dashboardCache.sel = []; render(); }
else if(action === 'modal-fermer'){ fermerModal(); }
else if(action === 'modal-fond'){ if(e.target === t) fermerModal(); }
else if(action === 'modal-valider'){ validerModal(); }
else if(action === 'iv-modifier'){ equipDetail.editIvId = t.dataset.id; equipDetail.editIvError = ''; equipDetail.showIvForm = false; render(); }
else if(action === 'iv-annuler-modif'){ equipDetail.editIvId = null; equipDetail.editIvError = ''; render(); }
else if(action === 'iv-supprimer'){ supprimerIntervention(t.dataset.id); }
else if(action === 'nouveau-client'){ ouvrirClientForm(null); }
else if(action === 'modifier-client'){ const c = (reglages.clients||[]).find(x => x.id === t.dataset.id); if(c) ouvrirClientForm(c); }
else if(action === 'fermer-client-form'){ reglages.clientForm = null; render(); }
else if(action === 'clients-statut'){ actionClientsStatut(t.dataset.id ? [t.dataset.id] : [...reglages.selClients], t.dataset.actif === '1'); }
else if(action === 'clients-supprimer'){ actionClientsSupprimer(t.dataset.id ? [t.dataset.id] : [...reglages.selClients]); }
else if(action === 'clients-desel'){ reglages.selClients = []; render(); }
else if(action === 'membres-active'){ actionMembresActive([...reglages.selMembres], t.dataset.active === '1'); }
else if(action === 'membres-supprimer'){ actionMembresSupprimer([...reglages.selMembres]); }
else if(action === 'membres-desel'){ reglages.selMembres = []; render(); }
else if(action === 'journal-rafraichir'){ reglages.journal = null; render(); }
else if(action === 'support-rafraichir'){ reglages.support = null; render(); }
else if(action === 'support-statut'){
setStatutDemande(t.dataset.id, t.dataset.statut)
.then(() => {
const d = (reglages.support || []).find(x => x.id === t.dataset.id);
if(d) d.statut = t.dataset.statut;
toast(t.dataset.statut === 'traite' ? 'Demande classée dans « Traitées »' : (t.dataset.statut === 'nouveau' ? 'Demande remise à traiter' : 'Demande marquée en cours'));
render();
})
.catch(err => toast('Erreur : ' + err.message, 'erreur'));
}
else if(action === 'support-supprimer'){ actionSupprimerDemande(t.dataset.id); }
else if(action === 'renommer-membre'){ ouvrirRenommage(t.dataset.id); }
else if(action === 'renommer-moi'){ renommerMoi(); }
else if(action === 'nouvel-equip-client'){
equipForm = { typeId:'', orgId:t.dataset.id, nom:'', serial_value:'', valeurs:{}, busy:false, error:'' };
nav('/equip-new');
}
else if(action === 'renommer-annuler'){ reglages.renommage = null; render(); }
else if(action === 'support-filtre'){ reglages.supportFiltre = t.dataset.filtre; render(); }
else if(action === 'toggle-invite-client'){ reglages.inviteOuvert = !reglages.inviteOuvert; render(); }
else if(action === 'restore-equip'){ restoreEquipement(); }
else if(action === 'toggle-edit-equip'){ equipDetail.showEditForm = !equipDetail.showEditForm; equipDetail.editError=''; render(); }
else if(action === 'print-qr'){ printQr(); }
else if(action === 'ouvrir-scanner'){ ouvrirScanner(); }
else if(action === 'fermer-scanner'){ fermerScanner(); }
else if(action === 'connexion-depuis-scan'){ connexionDepuisScan(); }
else if(action === 'toggle-partage'){ actionTogglePartage(); }
else if(action === 'regen-token'){ actionRegenererLienPublic(); }
else if(action === 'creer-invite'){ actionCreerInvite(); }
else if(action === 'annuler-invite'){ actionAnnulerInvite(t.dataset.id); }
else if(action === 'toggle-modeles'){ modeleState.ouvert = !modeleState.ouvert; render(); }
else if(action === 'appliquer-modele'){ appliquerModele(t.dataset.cle); }
else if(action === 'copier-lien'){ copierDansPressePapier(inviteUrl(t.dataset.token), t); }
else if(action === 'toggle-pw'){
// Manipulation directe du DOM : surtout pas de render(), qui effacerait la saisie.
const input = t.parentElement && t.parentElement.querySelector('input');
if(input){
const etaitVisible = input.type === 'text';
input.type = etaitVisible ? 'password' : 'text';
t.innerHTML = etaitVisible ? ICONE_OEIL : ICONE_OEIL_BARRE;
const libelle = etaitVisible ? 'Afficher le mot de passe' : 'Masquer le mot de passe';
t.setAttribute('aria-label', libelle);
t.setAttribute('title', libelle);
input.focus();
}
}
});

document.addEventListener('input', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const action = t.dataset.action;
if(action === 'dash-search'){ dashboardCache.search = t.value; debounce(refreshDashboard); }
else if(action === 'dash-filter-type'){ dashboardCache.typeId = t.value; refreshDashboard(); }
else if(action === 'dash-archived'){ dashboardCache.showArchived = t.checked; refreshDashboard(); }
else if(action === 'type-nom'){ typeForm.nom = t.value; }
else if(action === 'champ-label'){ typeForm.champs[+t.dataset.i].label = t.value; }
else if(action === 'champ-type'){ typeForm.champs[+t.dataset.i].type = t.value; }
else if(action === 'equip-nom'){ equipForm.nom = t.value; }
else if(action === 'equip-serial'){ equipForm.serial_value = t.value; verifierSerie(t.value, null); }
else if(action === 'edit-serial'){ verifierSerie(t.value, t.dataset.exclude || null); }
else if(action === 'equip-type'){ equipForm.typeId = t.value; render(); }
else if(action === 'equip-valeur'){ equipForm.valeurs[t.dataset.key] = t.value; }
else if(action === 'invite-org'){
reglages.invite = { orgId:t.value, role:reglages.invite.role, label:reglages.invite.label, tousTypes:true, types:[], busy:false, error:'', dernierToken:null };
render();
}
else if(action === 'invite-role'){ reglages.invite.role = t.value; render(); }
else if(action === 'invite-label'){ reglages.invite.label = t.value; }
else if(action === 'invite-tous-types'){
reglages.invite.tousTypes = t.checked;
if(t.checked) reglages.invite.types = [];
reglages.invite.error = ''; render();
}
else if(action === 'invite-type'){
const id = t.dataset.type;
reglages.invite.types = t.checked
? [...new Set([...reglages.invite.types, id])]
: reglages.invite.types.filter(x => x !== id);
reglages.invite.error = ''; render();
}
else if(action === 'sel-equip'){ basculer(dashboardCache, 'sel', t.dataset.id, t.checked); render(); }
else if(action === 'sel-equip-tous'){ dashboardCache.sel = t.checked ? (dashboardCache.items||[]).map(e => e.id) : []; render(); }
else if(action === 'sel-client'){ basculer(reglages, 'selClients', t.dataset.id, t.checked); render(); }
else if(action === 'sel-clients-tous'){ reglages.selClients = t.checked ? (t.dataset.ids || '').split(',').filter(Boolean) : []; render(); }
else if(action === 'recherche-client'){ reglages.rechercheClient = t.value; reglages.selClients = []; render(); }
else if(action === 'tri-clients'){ reglages.triClients = t.value; render(); }
else if(action === 'recherche-parc'){ reglages.rechercheParc = t.value; render(); }
else if(action === 'parc-archives'){ reglages.parcArchives = t.checked; render(); }
else if(action === 'sel-membre'){ basculer(reglages, 'selMembres', t.dataset.id, t.checked); render(); }
else if(action === 'sel-membres-tous'){
const ids = (t.dataset.ids || '').split(',').filter(Boolean);
reglages.selMembres = t.checked ? [...new Set([...reglages.selMembres, ...ids])] : reglages.selMembres.filter(x => !ids.includes(x));
render();
}
else if(action === 'filtre-client-membres'){ reglages.filtreClient = t.value; reglages.selMembres = []; render(); }
else if(action === 'modal-choix'){ modal.choix = t.value; modal.error = ''; render(); }
else if(action === 'modal-precision'){ modal.precision = t.value; }
else if(action === 'client-modele'){ reglages.clientForm.modele = t.value; majClientFormDepuisDom(); render(); }
else if(action === 'member-role'){ actionRoleMembre(t.dataset.id, t.value); }
else if(action === 'acces-tous'){ actionAccesTous(t.dataset.id, t.checked); }
else if(action === 'acces-type'){ actionAccesType(t.dataset.id, t.dataset.type, t.checked); }
});

document.addEventListener('submit', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
e.preventDefault();
const action = t.dataset.action;
if(action === 'submit-auth') handleAuthSubmit(t);
else if(action === 'submit-iv') submitIntervention(t);
else if(action === 'submit-join') handleJoinSubmit(t);
else if(action === 'submit-edit-equip') submitEditEquip(t);
else if(action === 'submit-iv-edit') submitEditIntervention(t);
else if(action === 'submit-client') submitClientForm(t);
else if(action === 'submit-support') submitSupport(t);
else if(action === 'submit-renommer') submitRenommage(t);
});

document.addEventListener('click', (e) => {
if(!e.target.closest('.user-menu')) closeMenus();
});
function closeMenus(){ document.getElementById('user-dropdown')?.classList.remove('open'); }

/* Ajoute / retire un identifiant d'une liste de sélection. */
function basculer(obj, cle, id, coche){
const l = obj[cle] || [];
obj[cle] = coche ? [...new Set([...l, id])] : l.filter(x => x !== id);
}

/* Avant un réaffichage du formulaire client, on recopie la saisie en cours
(sinon changer de modèle métier effacerait ce qui vient d'être tapé). */
function majClientFormDepuisDom(){
const form = document.querySelector('form[data-action="submit-client"]');
if(!form || !reglages.clientForm) return;
const fd = new FormData(form);
for(const k of ['nom','adresse','telephone','email','referent','notes']) reglages.clientForm[k] = (fd.get(k) || '').toString();
}

/* Échap ferme la fenêtre modale. */
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && modal && !modal.busy) fermerModal(); });

let debounceTimer;
function debounce(fn, ms=250){ clearTimeout(debounceTimer); debounceTimer = setTimeout(fn, ms); }

/* ---------------------------------------------------------------------- */
/* Auth bootstrap */
/* ---------------------------------------------------------------------- */

/* IMPORTANT : ne jamais attendre (await) un appel Supabase DANS ce callback.
supabase-js le déclenche en tenant son verrou d'authentification ; une requête
lancée dedans attend ce même verrou → blocage définitif de TOUTES les requêtes
(symptôme : listes qui ne chargent plus après un retour sur l'appli, ex. onglet
Équipements figé). On se contente de noter la session, puis on travaille
en dehors du callback (setTimeout 0), comme le recommande Supabase. */
sb.auth.onAuthStateChange((event, session) => {
const memeUtilisateur = !!(session && state.session && state.profile && state.profile.id === session.user.id);
state.session = session;
// Rafraîchissement du jeton, retour au premier plan : même utilisateur, rien à recharger.
if(session && memeUtilisateur && event !== 'INITIAL_SESSION') return;
setTimeout(() => appliquerSession(session), 0);
});

async function appliquerSession(session){
if(session !== state.session) return; // une autre session est arrivée entre-temps
state.accessError = '';
if(session){
try{
await loadProfileAndOrg();
await chargerStatutSuperAdmin();
await loadTypes(true);
retourApresConnexion();
// Préchargement discret : la liste des équipements est prête avant qu'on l'ouvre.
if(dashboardCache.items === null) setTimeout(() => { if(state.session && dashboardCache.items === null) chargerEquipements(); }, 300);
try{
state.enAttenteCount = await offlineCompterEnAttente();
if(navigator.onLine) synchroniserInterventionsEnAttente();
}catch(e){ console.error('[hors-ligne]', e); }
}catch(e){
console.error(e);
state.accessError = (e && e.message) ? e.message : 'Erreur de chargement du profil.';
}
} else {
state.profile = null; state.orgName = ''; state.superAdmin = false;
dashboardCache = dashboardInitial(dashboardCache.requete + 1); // invalide toute réponse encore en route
resetReglages();
modal = null;
supportState = { categorie:'question', sujet:'', message:'', email:'', busy:false, error:'', ok:'', mesDemandes:null };
accueilCache = { chiffres: null, loading: false, error: '' };
fondateurCache = { donnees:null, loading:false, error:'' };
joinState = { token:null, loading:false, preview:null, error:'', busy:false, notice:'' };
state.typesLoaded = false; state.types = [];
}
state.loading = false;
render();
}

render(); // premier rendu (spinner) pendant que la session se charge
