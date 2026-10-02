/* WiTracEQUIP — Signalement de panne par le personnel (sans compte).
   Trois morceaux, tous branchés sur les fonctions de la base (sql/17) :
   1. Page publique d'un équipement : badge « Signaler une panne » → code → formulaire.
      Aucun droit direct sur les tables : tout passe par verifier_code_signalement et
      signaler_panne, qui contrôlent le jeton du QR, le code et les limites d'envoi.
      L'heure est posée par le serveur.
   2. Liste « Signalements » des membres de l'organisation (responsable / administrateur :
      prendre en charge, créer l'intervention, traité, rejeter, supprimer).
   3. Écran du fondateur : changer le code de signalement, valable pour tous les clients. */

/* ---------------------------------------------------------------------- */
/* 1. Page publique                                                        */
/* ---------------------------------------------------------------------- */

const CLE_NOM_SIGNALEMENT = 'wte_nom_signalement';

function nomSignalementMemorise(){
try{ return localStorage.getItem(CLE_NOM_SIGNALEMENT) || ''; }catch(e){ return ''; }
}
function memoriserNomSignalement(nom){
try{ localStorage.setItem(CLE_NOM_SIGNALEMENT, nom); }catch(e){}
}

let signalPublic = { token:null, etape:'ferme', code:'', auteur:'', description:'', busy:false, error:'', deja:false, recuLe:null };

function signalPublicPour(token){
if(signalPublic.token !== token){
signalPublic = { token, etape:'ferme', code:'', auteur: nomSignalementMemorise(), description:'', busy:false, error:'', deja:false, recuLe:null };
}
return signalPublic;
}

function messageSignalement(e){
if(typeof estErreurReseau === 'function' && estErreurReseau(e)){
return "Pas de réseau : réessayez dès que vous êtes connecté.";
}
const m = (e && e.message) ? e.message : String(e || '');
if(/function .* does not exist|schema cache/i.test(m)) return "Le signalement n'est pas encore disponible. Prévenez directement votre responsable.";
return m;
}

function heureLisible(d){
try{ return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
catch(e){ return ''; }
}

function blocSignalementPublic(token){
const s = signalPublicPour(token);
const erreur = s.error ? `<div class="alert alert-error" role="alert">${esc(s.error)}</div>` : '';

if(s.etape === 'ferme'){
return `
<div class="card sp-carte">
<button type="button" class="btn sp-bouton" data-action="pub-panne-ouvrir">⚠️ Signaler une panne</button>
<div class="small muted">Réservé au personnel de l'établissement. Le code vous est donné par votre responsable.</div>
</div>`;
}

if(s.etape === 'code'){
return `
<form class="card sp-carte stack" data-action="submit-pub-code" novalidate>
<h3>Signaler une panne</h3>
${erreur}
<div class="field">
<label for="sp-code">Code de l'établissement</label>
<input id="sp-code" type="text" name="code" data-sp="code" value="${esc(s.code)}" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
</div>
<div class="row wrap">
<button class="btn btn-primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Vérification…' : 'Continuer'}</button>
<button class="btn" type="button" data-action="pub-panne-fermer">Annuler</button>
</div>
</form>`;
}

if(s.etape === 'form'){
return `
<form class="card sp-carte stack" data-action="submit-pub-panne" novalidate>
<h3>Signaler une panne</h3>
${erreur}
<div class="field">
<label for="sp-auteur">Nom et prénom</label>
<input id="sp-auteur" type="text" name="auteur" data-sp="auteur" value="${esc(s.auteur)}" autocomplete="name" maxlength="120" required>
</div>
<div class="field">
<label>Heure</label>
<div class="small">${esc(heureLisible(new Date()))} <span class="muted">· enregistrée automatiquement à l'envoi</span></div>
</div>
<div class="field">
<label for="sp-description">Description de la panne</label>
<textarea id="sp-description" name="description" data-sp="description" maxlength="1000" placeholder="Ce qui ne fonctionne pas, où, depuis quand…" required>${esc(s.description)}</textarea>
</div>
<div class="row wrap">
<button class="btn btn-primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Envoi…' : 'Envoyer le signalement'}</button>
<button class="btn" type="button" data-action="pub-panne-fermer">Annuler</button>
</div>
</form>`;
}

// etape === 'envoye'
return `
<div class="card sp-carte stack">
<h3>Signalement envoyé</h3>
<div class="alert alert-info" role="status">Votre responsable a été prévenu${s.recuLe ? ` (${esc(heureLisible(s.recuLe))})` : ''}.</div>
${s.deja ? `<div class="small muted">Une panne était déjà signalée sur cet équipement ces dernières 24 heures : votre message a été ajouté.</div>` : ''}
<div class="row wrap">
<button class="btn" type="button" data-action="pub-panne-nouveau">Signaler autre chose</button>
<button class="btn" type="button" data-action="pub-panne-fermer">Fermer</button>
</div>
</div>`;
}

async function envoyerCodeSignalement(form){
const s = signalPublic;
s.code = String(new FormData(form).get('code') || '').trim();
if(!s.code){ s.error = 'Saisissez le code.'; render(); return; }
if(!navigator.onLine){ s.error = 'Pas de réseau : réessayez dès que vous êtes connecté.'; render(); return; }
s.busy = true; s.error = ''; render();
try{
const { data, error } = await sb.rpc('verifier_code_signalement', { p_token: s.token, p_code: s.code });
if(error) throw error;
if(data !== true){ s.error = 'Code incorrect.'; }
else{ s.etape = 'form'; s.error = ''; }
}catch(e){
s.error = messageSignalement(e);
}
s.busy = false; render();
}

async function envoyerSignalement(form){
const s = signalPublic;
const fd = new FormData(form);
s.auteur = String(fd.get('auteur') || '').trim();
s.description = String(fd.get('description') || '').trim();
if(s.auteur.length < 2){ s.error = 'Indiquez votre nom et prénom.'; render(); return; }
if(s.description.length < 3){ s.error = 'Décrivez la panne en quelques mots.'; render(); return; }
if(!navigator.onLine){ s.error = 'Pas de réseau : réessayez dès que vous êtes connecté. Votre texte est conservé.'; render(); return; }
s.busy = true; s.error = ''; render();
try{
const { data, error } = await sb.rpc('signaler_panne', {
p_token: s.token, p_code: s.code, p_auteur: s.auteur, p_description: s.description,
});
if(error) throw error;
if(data && data.ok === false){
s.error = data.erreur || 'Code incorrect.';
s.etape = 'code'; s.code = '';
s.busy = false; render(); return;
}
memoriserNomSignalement(s.auteur);
s.deja = !!(data && data.deja_signale);
s.recuLe = (data && data.recu_le) || null;
s.description = '';
s.etape = 'envoye';
}catch(e){
s.error = messageSignalement(e);
}
s.busy = false; render();
}

/* ---------------------------------------------------------------------- */
/* 2. Liste des signalements (membres de l'organisation)                   */
/* ---------------------------------------------------------------------- */

let signalListe = { uid:null, items:null, loading:false, error:'', filtre:'ouverts', compteur:0, compteurMaj:0, compteurBusy:false };
let signalPrefill = null;

function signalListeVerifierCompte(){
const uid = state.session?.user?.id || null;
if(signalListe.uid !== uid){
signalListe = { uid, items:null, loading:false, error:'', filtre:'ouverts', compteur:0, compteurMaj:0, compteurBusy:false };
}
}

/* Pastille de la navigation : nombre de signalements « nouveau ». Rafraîchie au plus
   toutes les 90 s ; une erreur (réseau, script SQL 17 pas encore passé) est ignorée. */
function nbSignalementsNouveaux(){
if(!state.session || !state.profile) return 0;
signalListeVerifierCompte();
const l = signalListe;
if(!l.compteurBusy && navigator.onLine && Date.now() - l.compteurMaj > 90000){
l.compteurBusy = true; l.compteurMaj = Date.now();
sb.from('signalements_panne').select('id', { count:'exact', head:true }).eq('statut', 'nouveau')
.then(({ count, error }) => {
if(error || state.session?.user?.id !== l.uid) return;
const ancien = l.compteur; l.compteur = count || 0;
if(ancien !== l.compteur) render();
})
.catch(() => {})
.finally(() => { l.compteurBusy = false; });
}
return l.compteur;
}

function chargerSignalements(force){
signalListeVerifierCompte();
const l = signalListe;
if(l.loading || (l.items !== null && !force)) return;
if(l.error && !force) return;
l.loading = true; l.error = '';
sb.from('signalements_panne')
.select('id, created_at, auteur, description, statut, traite_par, traite_le, equipement_id, organization_id, equipements(nom, serial_value), organizations(nom)')
.order('created_at', { ascending:false })
.limit(200)
.then(({ data, error }) => {
if(error) throw error;
l.items = data || [];
l.compteur = l.items.filter(x => x.statut === 'nouveau').length;
l.compteurMaj = Date.now();
})
.catch(e => { l.error = messageSignalement(e); })
.finally(() => { l.loading = false; render(); });
}

function badgeStatutSignalement(st){
if(st === 'traite') return '<span class="badge badge-ok">traité</span>';
if(st === 'pris_en_charge') return '<span class="badge badge-neutral">pris en charge</span>';
if(st === 'rejete') return '<span class="badge badge-neutral">rejeté</span>';
return '<span class="badge badge-warn">nouveau</span>';
}

function peutTraiterSignalements(){
return typeof peutGererEquipe === 'function' && peutGererEquipe();
}

function ligneSignalement(x){
const eq = x.equipements || {};
const nom = eq.nom || 'Équipement';
const ouvert = x.statut === 'nouveau' || x.statut === 'pris_en_charge';
const agir = peutTraiterSignalements();
const orgNom = (isSuperAdmin() && x.organizations && x.organizations.nom) ? ` · ${esc(x.organizations.nom)}` : '';
return `
<div class="card sp-ligne">
<div class="sp-tete"><strong>${esc(nom)}</strong>${eq.serial_value ? ` <span class="muted small">${esc(eq.serial_value)}</span>` : ''} ${badgeStatutSignalement(x.statut)}</div>
<div class="small muted">${esc(x.auteur)} · ${esc(fmtDateTime(x.created_at))}${orgNom}</div>
<p class="sp-texte">${esc(x.description)}</p>
${x.traite_par && x.statut !== 'nouveau' ? `<div class="small muted">${esc(x.traite_par)}${x.traite_le ? ' · ' + esc(fmtDateTime(x.traite_le)) : ''}</div>` : ''}
<div class="row wrap sp-actions">
<button type="button" class="btn btn-sm" data-action="go" data-path="/equip/${esc(x.equipement_id)}">Ouvrir la fiche</button>
${agir && x.statut === 'nouveau' ? `<button type="button" class="btn btn-sm" data-action="signal-statut" data-id="${esc(x.id)}" data-statut="pris_en_charge">Prendre en charge</button>` : ''}
${agir && ouvert ? `<button type="button" class="btn btn-sm btn-primary" data-action="signal-intervention" data-id="${esc(x.id)}">Créer l'intervention</button>
<button type="button" class="btn btn-sm" data-action="signal-statut" data-id="${esc(x.id)}" data-statut="traite">Marquer traité</button>
<button type="button" class="btn btn-sm" data-action="signal-statut" data-id="${esc(x.id)}" data-statut="rejete">Rejeter</button>` : ''}
${agir && !ouvert ? `<button type="button" class="btn btn-sm" data-action="signal-statut" data-id="${esc(x.id)}" data-statut="nouveau">Rouvrir</button>` : ''}
${agir ? `<button type="button" class="btn btn-sm" data-action="signal-supprimer" data-id="${esc(x.id)}" aria-label="Supprimer le signalement" title="Supprimer">${iconeNav('trash', 15)}</button>` : ''}
</div>
</div>`;
}

function viewSignalements(){
chargerSignalements(false);
const l = signalListe;
const tous = l.items || [];
const ouverts = tous.filter(x => x.statut === 'nouveau' || x.statut === 'pris_en_charge');
const liste = l.filtre === 'tous' ? tous : ouverts;
let corps;
if(l.items === null && !l.error){
corps = typeof squeletteListe === 'function' ? squeletteListe(3) : '<div class="spinner"></div>';
}else if(l.error){
corps = `<div class="alert alert-error">${esc(l.error)}</div>
<button type="button" class="btn" data-action="signal-recharger">Réessayer</button>`;
}else if(!liste.length){
corps = `<div class="card"><div class="empty small">${l.filtre === 'tous' ? 'Aucun signalement pour le moment.' : 'Aucune panne à traiter.'}</div></div>`;
}else{
corps = liste.map(ligneSignalement).join('');
}
return `
<div class="fiche-entete">
<div class="titre"><h2>Signalements de panne</h2>
<div class="small muted">Pannes signalées par le personnel en scannant le QR code d'un équipement.</div></div>
</div>
<div class="row wrap" style="margin-bottom:12px;">
<button type="button" class="btn btn-sm ${l.filtre === 'ouverts' ? 'btn-primary' : ''}" data-action="signal-filtre" data-v="ouverts">À traiter${l.items ? ` (${ouverts.length})` : ''}</button>
<button type="button" class="btn btn-sm ${l.filtre === 'tous' ? 'btn-primary' : ''}" data-action="signal-filtre" data-v="tous">Tous${l.items ? ` (${tous.length})` : ''}</button>
<button type="button" class="btn btn-sm" data-action="signal-recharger" title="Actualiser">${iconeNav('undo', 15)}</button>
</div>
${corps}`;
}

/* Un clic sur « Créer l'intervention » ouvre la fiche avec le formulaire d'intervention
   déjà rempli (type + description reprenant le signalement). Appliqué par viewEquipDetail. */
function appliquerPrefillSignalement(equipId){
if(!signalPrefill || signalPrefill.equipId !== equipId) return;
equipDetail.showIvForm = true;
equipDetail.brouillon = signalPrefill.brouillon;
signalPrefill = null;
}

async function changerStatutSignalement(id, statut){
const x = (signalListe.items || []).find(i => i.id === id);
if(!x) return;
if(statut === 'rejete' && !await confirmer('Rejeter ce signalement ?\n\nIl restera visible dans « Tous », marqué comme rejeté.', { ok:'Rejeter' })) return;
const par = state.profile?.full_name || state.session?.user?.email || '';
const maj = statut === 'nouveau'
? { statut, traite_par: null, traite_le: null }
: { statut, traite_par: par, traite_le: new Date().toISOString() };
const { error } = await sb.from('signalements_panne').update(maj).eq('id', id);
if(error){ toast('Erreur : ' + error.message, 'erreur'); return; }
Object.assign(x, maj);
signalListe.compteur = (signalListe.items || []).filter(i => i.statut === 'nouveau').length;
render();
}

async function supprimerSignalement(id){
if(!await confirmer('Supprimer ce signalement ?\n\nCette action est définitive.', { danger:true, ok:'Supprimer' })) return;
const { error } = await sb.from('signalements_panne').delete().eq('id', id);
if(error){ toast('Erreur : ' + error.message, 'erreur'); return; }
signalListe.items = (signalListe.items || []).filter(i => i.id !== id);
signalListe.compteur = signalListe.items.filter(i => i.statut === 'nouveau').length;
render();
}

function creerInterventionDepuisSignalement(id){
const x = (signalListe.items || []).find(i => i.id === id);
if(!x) return;
signalPrefill = {
equipId: x.equipement_id,
brouillon: {
type: 'Réparation (panne signalée)',
description: `Panne signalée par ${x.auteur} le ${fmtDateTime(x.created_at)} : ${x.description}`,
},
};
nav('/equip/' + x.equipement_id);
}

/* ---------------------------------------------------------------------- */
/* 3. Code de signalement (fondateur)                                      */
/* ---------------------------------------------------------------------- */

async function ouvrirCodeSignalement(){
if(!isSuperAdmin()) return;
let actuel = '';
try{
const { data, error } = await sb.rpc('lire_code_signalement');
if(error) throw error;
actuel = data || '';
}catch(e){
toast('Code indisponible : ' + messageSignalement(e), 'erreur');
return;
}
const r = await ouvrirFormulaire({
titre: 'Code de signalement de panne',
texte: "Ce code s'applique à tous vos clients. Une fois changé, l'ancien code ne fonctionne plus : prévenez vos clients du nouveau code.",
champs: [{ name:'code', label:'Code', type:'text', valeur: actuel }],
ok: 'Enregistrer',
verifier: async (v) => {
const code = String(v.code || '').trim();
if(code.length < 4) return 'Le code doit faire au moins 4 caractères.';
if(/\s/.test(code)) return "Le code ne doit pas contenir d'espace.";
const { error } = await sb.rpc('definir_code_signalement', { p_code: code });
return error ? messageSignalement(error) : null;
},
});
if(r) toast('Code de signalement enregistré.');
}

/* ---------------------------------------------------------------------- */
/* Événements                                                              */
/* ---------------------------------------------------------------------- */

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const a = t.dataset.action;
if(a === 'pub-panne-ouvrir'){ const s = signalPublicPour(fichePublique.token || state.route.param); s.etape = 'code'; s.error = ''; render(); setTimeout(() => document.getElementById('sp-code')?.focus(), 30); }
else if(a === 'pub-panne-fermer'){ const s = signalPublicPour(fichePublique.token || state.route.param); s.etape = 'ferme'; s.error = ''; s.code = ''; s.description = ''; render(); }
else if(a === 'pub-panne-nouveau'){ const s = signalPublic; s.etape = 'form'; s.error = ''; s.description = ''; render(); }
else if(a === 'signal-filtre'){ signalListe.filtre = t.dataset.v === 'tous' ? 'tous' : 'ouverts'; render(); }
else if(a === 'signal-recharger'){ chargerSignalements(true); render(); }
else if(a === 'signal-statut'){ changerStatutSignalement(t.dataset.id, t.dataset.statut); }
else if(a === 'signal-supprimer'){ supprimerSignalement(t.dataset.id); }
else if(a === 'signal-intervention'){ creerInterventionDepuisSignalement(t.dataset.id); }
else if(a === 'fondateur-code-signalement'){ ouvrirCodeSignalement(); }
});

document.addEventListener('submit', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const a = t.dataset.action;
if(a === 'submit-pub-code'){ e.preventDefault(); envoyerCodeSignalement(t); }
else if(a === 'submit-pub-panne'){ e.preventDefault(); envoyerSignalement(t); }
});

/* La saisie en cours survit à un réaffichage de la page. */
document.addEventListener('input', (e) => {
const c = e.target && e.target.dataset && e.target.dataset.sp;
if(c && (c === 'code' || c === 'auteur' || c === 'description')) signalPublic[c] = e.target.value;
});
