/* ---------------------------------------------------------------------- */
/* Support → Rapport d'intervention (fondateur)                            */
/* ---------------------------------------------------------------------- */
/* Un rapport = qui est intervenu (support), chez quel client, quand,
   pourquoi, la signature du client (dessinée au doigt) et des pièces jointes.
   Stockage : table « rapports_intervention » + bucket privé
   « rapports-intervention » (voir rapports_intervention.sql). Tout est
   réservé au super-administrateur : la base le vérifie elle-même (RLS). */

const BUCKET_RAPPORTS = 'rapports-intervention';
const RP_TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par document

function rpAujourdhui(){
const d = new Date();
return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function rpFormVide(){
return {
nom_support: ((state.profile && state.profile.full_name) || '').trim() || (state.session && state.session.user.email) || '',
client_id: '',
date: rpAujourdhui(),
raison: '',
signataire: '',
email_destinataire: '',
signature: null,
fichiers: [],
};
}

function rpEtatInitial(uid){
return { uid, form: rpFormVide(), liste: null, listeLoading: false, listeError: '', busy: false, error: '', ouvert: null, urls: {} };
}
let rapports = { uid: null, form: null };

/* ---------- Chargement de la liste ---------- */

function chargerRapports(force){
if(rapports.listeLoading) return;
if(rapports.liste !== null && !force) return;
if(rapports.listeError && !force) return; // pas de relance en boucle sur une erreur
rapports.listeLoading = true;
sb.from('rapports_intervention')
.select('id, organization_id, nom_support, date_intervention, raison, nom_signataire, email_destinataire, signature_path, pieces_jointes, created_at, archived_at, organizations(nom, code_client)')
.is('archived_at', null)
.order('date_intervention', { ascending: false })
.order('created_at', { ascending: false })
.limit(100)
.then(({ data, error }) => { if(error) throw error; rapports.liste = data || []; rapports.listeError = ''; })
.catch(e => { rapports.listeError = e.message || String(e); })
.finally(() => { rapports.listeLoading = false; render(); });
}

/* ---------- Affichage ---------- */

function viewRapports(){
const uid = state.session && state.session.user.id;
if(rapports.uid !== uid || !rapports.form) rapports = rpEtatInitial(uid);
chargerRapports(false);
requestAnimationFrame(rpPreparerCanvas);

const f = rapports.form;
const clients = [...(reglages.clients || [])].filter(c => !c.est_mon_organisation)
.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

return `
<div class="card">
<h3 style="margin-bottom:10px;">Nouveau rapport d'intervention</h3>
${rapports.error ? `<div class="alert alert-error">${esc(rapports.error)}</div>` : ''}
<form id="rp-form" novalidate>
<div class="grid-2">
<div class="field"><label>Nom du support <span class="oblig">obligatoire</span></label>
<input type="text" name="nom_support" data-rp="champ" value="${esc(f.nom_support)}" placeholder="Qui a réalisé l'intervention ?"></div>
<div class="field"><label>Date de l'intervention <span class="oblig">obligatoire</span></label>
<input type="date" name="date" data-rp="champ" value="${esc(f.date)}"></div>
</div>
<div class="field"><label>Client <span class="oblig">obligatoire</span></label>
<select name="client_id" data-rp="champ" ${reglages.clients === null ? 'disabled' : ''}>
<option value="">${reglages.clients === null ? 'Chargement des clients…' : '— Choisir un client —'}</option>
${clients.map(c => `<option value="${c.id}" ${c.id === f.client_id ? 'selected' : ''}>${esc(c.nom)}${c.code_client ? ' — n° ' + esc(c.code_client) : ''}</option>`).join('')}
</select></div>
<div class="field">
<label>Adresse e-mail du destinataire <span class="oblig">obligatoire</span></label>
<input
type="email"
name="email_destinataire"
data-rp="champ"
value="${esc(f.email_destinataire)}"
placeholder="exemple@entreprise.fr"
autocomplete="email">
<div class="hint">
Adresse de la personne qui recevra ce rapport. Elle peut être différente du contact principal du client.
</div>
</div>
<div class="field"><label>Raison de l'intervention <span class="oblig">obligatoire</span></label>
<textarea name="raison" data-rp="champ" rows="4" placeholder="Décrivez la raison de l'intervention et ce qui a été fait…">${esc(f.raison)}</textarea></div>

<div class="field"><label>Documents joints <span class="muted small">(facultatif — PDF, photo, Word, Excel… 10 Mo max chacun)</span></label>
${f.fichiers.length ? f.fichiers.map((x, i) => `
<div class="list-item" style="padding:8px 0;">
<div style="flex:1;min-width:0;overflow-wrap:anywhere;">${esc(x.name)} <span class="small muted">· ${rpTaille(x.size)}</span></div>
<button type="button" class="btn btn-sm btn-danger" data-rp="retirer-fichier" data-i="${i}">Retirer</button>
</div>`).join('') : ''}
<label class="btn btn-sm" style="margin-top:6px;cursor:pointer;">+ Joindre un document
<input type="file" multiple data-rp="fichiers" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" style="display:none;"></label>
</div>

<div class="field"><label>Signature du client <span class="oblig">obligatoire</span></label>
<div class="hint" style="margin:0 0 6px;">Le client signe avec le doigt dans le cadre ci-dessous.</div>
<canvas id="rp-sig" style="display:block;width:100%;aspect-ratio:2/1;background:#fff;border:2px dashed var(--border);border-radius:10px;touch-action:none;"></canvas>
<div class="row between wrap" style="margin-top:6px;gap:8px;">
<input type="text" name="signataire" data-rp="champ" value="${esc(f.signataire)}" placeholder="Nom du signataire (facultatif)" style="flex:1;min-width:180px;">
<button type="button" class="btn btn-sm" data-rp="effacer">Effacer la signature</button>
</div></div>

<button class="btn btn-primary" type="submit" ${rapports.busy ? 'disabled' : ''}>${rapports.busy ? 'Enregistrement…' : 'Enregistrer le rapport'}</button>
</form>
</div>

<div class="card">
<div class="row between wrap" style="margin-bottom:6px;">
<h3>Rapports enregistrés</h3>
<button class="btn btn-sm" data-rp="actualiser">Actualiser</button>
</div>
${viewListeRapports()}
</div>`;
}

function viewListeRapports(){
if(rapports.listeError){
return `<div class="alert alert-error">${esc(rapports.listeError)}<br><span class="small">Si le message parle d'une table introuvable, le fichier SQL « rapports_intervention.sql » n'a pas encore été exécuté dans Supabase.</span></div>`;
}
if(rapports.liste === null) return squeletteListe(3);
if(!rapports.liste.length) return `<div class="empty small">Aucun rapport pour l'instant.</div>`;
return rapports.liste.map(r => {
const ouvert = rapports.ouvert === r.id;
const pj = r.pieces_jointes || [];
return `
<div class="list-item" style="flex-wrap:wrap;align-items:flex-start;">
<div style="flex:1;min-width:200px;">
<div style="font-weight:650;">${esc((r.organizations && r.organizations.nom) || 'Client')}</div>
<div class="small muted">${fmtDate(r.date_intervention)} · par ${esc(r.nom_support)}${pj.length ? ` · ${pj.length} document${pj.length > 1 ? 's' : ''}` : ''}</div>
</div>
<button class="btn btn-sm" data-rp="ouvrir" data-id="${r.id}">${ouvert ? 'Masquer' : 'Voir'}</button>
${ouvert ? `
<div style="flex-basis:100%;padding-top:8px;">
<div style="white-space:pre-wrap;overflow-wrap:anywhere;">${esc(r.raison)}</div>

<div class="small muted" style="margin-top:8px;">
<strong>Destinataire :</strong>
${r.email_destinataire ? esc(r.email_destinataire) : 'Non renseigné'}
</div>

<div class="small muted" style="margin-top:8px;">
Signature${r.nom_signataire ? ' de ' + esc(r.nom_signataire) : ' du client'} :
</div>
${rapports.urls[r.signature_path]
? `<img src="${esc(rapports.urls[r.signature_path])}" alt="Signature" style="display:block;max-width:320px;width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;margin-top:4px;">`
: `<div class="small muted">Chargement…</div>`}
${pj.length ? `<div class="small muted" style="margin-top:10px;">Documents joints :</div>
${pj.map(p => rapports.urls[p.chemin]
? `<div><a href="${esc(rapports.urls[p.chemin])}" target="_blank" rel="noopener">${esc(p.nom)}</a></div>`
: `<div class="small muted">${esc(p.nom)} …</div>`).join('')}` : ''}
<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">

<button class="btn btn-sm" data-rp="modifier" data-id="${r.id}">
✏️ Modifier
</button>

<button class="btn btn-sm" data-rp="archiver" data-id="${r.id}">
🗄️ Archiver
</button>

<button class="btn btn-sm" data-rp="exporter" data-id="${r.id}">
📄 Exporter PDF
</button>

<button class="btn btn-sm" data-rp="email" data-id="${r.id}">
✉ Préparer l'e-mail
</button>

<button class="btn btn-sm btn-danger" data-rp="supprimer" data-id="${r.id}">
Supprimer ce rapport
</button>

</div>
</div>` : ''}
</div>`;
}).join('');
}

function rpTaille(o){
return o >= 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko';
}

/* ---------- Signature au doigt ---------- */

/* Le formulaire est redessiné à chaque render() : la signature déjà tracée
   est donc conservée en mémoire (dataURL) et repeinte sur le nouveau canvas. */
function rpPreparerCanvas(){
const c = document.getElementById('rp-sig');
if(!c) return;
const r = c.getBoundingClientRect();
if(!r.width) return;
const dpr = window.devicePixelRatio || 1;
c.width = Math.round(r.width * dpr);
c.height = Math.round(r.height * dpr);
const ctx = c.getContext('2d');
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
if(rapports.form && rapports.form.signature){
const img = new Image();
img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
img.src = rapports.form.signature;
}
}

let rpDessin = null;

function rpPoint(c, e){
const r = c.getBoundingClientRect();
return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
}

document.addEventListener('pointerdown', (e) => {
const c = e.target;
if(!c || c.id !== 'rp-sig') return;
e.preventDefault();
if(c.setPointerCapture) try{ c.setPointerCapture(e.pointerId); }catch(_){}
const ctx = c.getContext('2d');
ctx.lineWidth = 2.6 * (window.devicePixelRatio || 1);
ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
const p = rpPoint(c, e);
ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
rpDessin = { c, ctx, dernier: p };
});

document.addEventListener('pointermove', (e) => {
if(!rpDessin) return;
e.preventDefault();
const p = rpPoint(rpDessin.c, e);
rpDessin.ctx.beginPath();
rpDessin.ctx.moveTo(rpDessin.dernier.x, rpDessin.dernier.y);
rpDessin.ctx.lineTo(p.x, p.y);
rpDessin.ctx.stroke();
rpDessin.dernier = p;
});

function rpFinDessin(){
if(!rpDessin) return;
if(rapports.form) rapports.form.signature = rpDessin.c.toDataURL('image/png');
rpDessin = null;
}
document.addEventListener('pointerup', rpFinDessin);
document.addEventListener('pointercancel', rpFinDessin);

/* ---------- Enregistrement ---------- */

function rpDataUrlVersBlob(u){
const [tete, corps] = u.split(',');
const mime = (/:(.*?);/.exec(tete) || [])[1] || 'image/png';
const bin = atob(corps);
const a = new Uint8Array(bin.length);
for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
return new Blob([a], { type: mime });
}

/* Nom de fichier sans accents ni caractères que le stockage refuse. */
function rpNomSur(nom){
return String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'document';
}

async function rpEnregistrer(){
if(rapports.busy) return;
const f = rapports.form;

const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email_destinataire.trim());

const erreur = !f.nom_support.trim() ? 'Indiquez le nom du support.'
: !f.client_id ? 'Choisissez un client.'
: !f.date ? "Indiquez la date de l'intervention."
: !f.raison.trim() ? "Indiquez la raison de l'intervention."
: !f.email_destinataire.trim() ? "Indiquez l'adresse e-mail du destinataire."
: !emailValide ? "L'adresse e-mail indiquée n'est pas valide."
: !f.signature ? 'La signature du client est obligatoire.' : '';
if(erreur){ rapports.error = erreur; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

rapports.busy = true; rapports.error = ''; render();
const id = idAleatoire();
const dossier = `${f.client_id}/${id}`;
const envoyes = [];
try{
const cheminSig = `${dossier}/signature.png`;
let r = await sb.storage.from(BUCKET_RAPPORTS).upload(cheminSig, rpDataUrlVersBlob(f.signature), { contentType: 'image/png', upsert: false });
if(r.error) throw r.error;
envoyes.push(cheminSig);

const pieces = [];
for(const [i, fichier] of f.fichiers.entries()){
const chemin = `${dossier}/pj-${i + 1}-${rpNomSur(fichier.name)}`;
r = await sb.storage.from(BUCKET_RAPPORTS).upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream', upsert: false });
if(r.error) throw r.error;
envoyes.push(chemin);
pieces.push({ chemin, nom: fichier.name, taille: fichier.size, type: fichier.type || '' });
}

const { error } = await sb.from('rapports_intervention').insert({
id,
organization_id: f.client_id,
nom_support: f.nom_support.trim(),
date_intervention: f.date,
raison: f.raison.trim(),
nom_signataire: f.signataire.trim() || null,
email_destinataire: f.email_destinataire.trim(),
signature_path: cheminSig,
pieces_jointes: pieces,
});
if(error) throw error;

rapports.form = rpFormVide();
rapports.liste = null; // rechargée à l'affichage suivant
toast("Rapport d'intervention enregistré");
}catch(e){
// Rien ne doit rester à moitié envoyé : on retire les fichiers déjà partis.
if(envoyes.length) sb.storage.from(BUCKET_RAPPORTS).remove(envoyes).catch(() => {});
rapports.error = "Enregistrement impossible : " + (e.message || e);
}finally{
rapports.busy = false; render();
}
}

async function rpOuvrir(id){
if(rapports.ouvert === id){ rapports.ouvert = null; render(); return; }
rapports.ouvert = id; render();
const r = (rapports.liste || []).find(x => x.id === id);
if(!r) return;
const chemins = [r.signature_path, ...(r.pieces_jointes || []).map(p => p.chemin)].filter(c => c && !rapports.urls[c]);
if(!chemins.length) return;
const { data, error } = await sb.storage.from(BUCKET_RAPPORTS).createSignedUrls(chemins, 3600);
if(error){ toast('Impossible de charger les fichiers : ' + error.message, 'erreur'); return; }
(data || []).forEach(x => { if(x.signedUrl) rapports.urls[x.path] = x.signedUrl; });
render();
}
/* ---------- MODIFICATION D'UN RAPPORT ---------- */

async function rpModifier(id){

const r = (rapports.liste || []).find(x => x.id === id);

if(!r){
toast('Rapport introuvable.', 'erreur');
return;
}

/*
   On recharge le rapport dans le formulaire.
   Les fichiers et la signature existants sont conservés.
*/

rapports.form = {
nom_support: r.nom_support || '',
client_id: r.organization_id || '',
date: r.date_intervention || rpAujourdhui(),
raison: r.raison || '',
signataire: r.nom_signataire || '',
email_destinataire: r.email_destinataire || '',
signature: rapports.urls[r.signature_path] || null,
fichiers: [],
};

rapports.modificationId = id;
rapports.error = '';

render();

window.scrollTo({
top: 0,
behavior: 'smooth'
});

toast('Rapport chargé pour modification');
}


/* ---------- ENREGISTREMENT D'UNE MODIFICATION ---------- */

async function rpEnregistrerModification(){

const id = rapports.modificationId;

if(!id){
rpEnregistrer();
return;
}

if(rapports.busy) return;

const f = rapports.form;

const emailValide =
/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
f.email_destinataire.trim()
);

const erreur =
!f.nom_support.trim()
? 'Indiquez le nom du support.'

: !f.client_id
? 'Choisissez un client.'

: !f.date
? "Indiquez la date de l'intervention."

: !f.raison.trim()
? "Indiquez la raison de l'intervention."

: !f.email_destinataire.trim()
? "Indiquez l'adresse e-mail du destinataire."

: !emailValide
? "L'adresse e-mail indiquée n'est pas valide."

: '';

if(erreur){

rapports.error = erreur;

render();

window.scrollTo({
top:0,
behavior:'smooth'
});

return;
}

rapports.busy = true;
rapports.error = '';

try{

const { error } = await sb
.from('rapports_intervention')
.update({

organization_id: f.client_id,

nom_support:
f.nom_support.trim(),

date_intervention:
f.date,

raison:
f.raison.trim(),

nom_signataire:
f.signataire.trim() || null,

email_destinataire:
f.email_destinataire.trim()

})
.eq('id', id);

if(error) throw error;

rapports.modificationId = null;

rapports.form = rpFormVide();

rapports.liste = null;

toast('Rapport modifié avec succès');

}catch(e){

rapports.error =
'Modification impossible : ' +
(e.message || e);

}finally{

rapports.busy = false;

render();

}

}
async function /* ---------- ARCHIVER ---------- */

async function rpArchiver(id){

const r = (rapports.liste || []).find(x => x.id === id);

if(!r) return;

if(!await confirmer(
'Archiver ce rapport ?\n\nLe rapport ne sera pas supprimé. Il pourra être retrouvé dans les archives.',
{
ok:'Archiver'
}
)) return;

try{

const { error } = await sb
.from('rapports_intervention')
.update({
archived_at: new Date().toISOString()
})
.eq('id', id);

if(error) throw error;

rapports.liste =
rapports.liste.filter(x => x.id !== id);

rapports.ouvert = null;

toast('Rapport archivé');

}catch(e){

toast(
'Archivage impossible : ' +
(e.message || e),
'erreur'
);

}

render();

}rpSupprimer(id){
const r = (rapports.liste || []).find(x => x.id === id);
if(!r) return;
if(!await confirmer('Supprimer ce rapport ?\n\nLe rapport, la signature et les documents joints seront définitivement effacés.', { danger: true, ok: 'Supprimer' })) return;
try{
const chemins = [r.signature_path, ...(r.pieces_jointes || []).map(p => p.chemin)].filter(Boolean);
if(chemins.length){
const { error: e1 } = await sb.storage.from(BUCKET_RAPPORTS).remove(chemins);
if(e1) throw e1;
}
const { error } = await sb.from('rapports_intervention').delete().eq('id', id);
if(error) throw error;
rapports.liste = rapports.liste.filter(x => x.id !== id);
rapports.ouvert = null;
toast('Rapport supprimé');
}catch(e){ toast('Suppression impossible : ' + (e.message || e), 'erreur'); }
render();
}

function rpAjouterFichiers(input){
const ajoutes = Array.from(input.files || []);
input.value = '';
for(const x of ajoutes){
if(x.size > RP_TAILLE_MAX){ toast(`« ${x.name} » dépasse 10 Mo : non ajouté.`, 'erreur'); continue; }
rapports.form.fichiers.push(x);
}
render();
}

/* ---------- Événements ---------- */

document.addEventListener('input', (e) => {
const t = e.target;
if(t && t.dataset && t.dataset.rp === 'champ' && rapports.form) rapports.form[t.name] = t.value;
});

document.addEventListener('change', (e) => {
const t = e.target;
if(!t || !t.dataset || !rapports.form) return;
if(t.dataset.rp === 'champ') rapports.form[t.name] = t.value;
else if(t.dataset.rp === 'fichiers') rpAjouterFichiers(t);
});

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-rp]');
if(!t || !rapports.form) return;

const a = t.dataset.rp;

if(a === 'effacer'){
rapports.form.signature = null;
rpPreparerCanvas();
}

else if(a === 'retirer-fichier'){
rapports.form.fichiers.splice(+t.dataset.i, 1);
render();
}

else if(a === 'ouvrir'){
rpOuvrir(t.dataset.id);
}

else if(a === 'supprimer'){
rpSupprimer(t.dataset.id);
}

else if(a === 'modifier'){
rpModifier(t.dataset.id);
}

else if(a === 'archiver'){
rpArchiver(t.dataset.id);
}

else if(a === 'exporter'){
else if(a === 'email'){
rpPreparerEmail(t.dataset.id);
}

else if(a === 'actualiser'){
rapports.listeError = '';
chargerRapports(true);
}
});

document.addEventListener('submit', (e) => {
if(e.target && e.target.id === 'rp-form'){ e.preventDefault(); rpEnregistrer(); }
});
/* ---------- EXPORT PDF / EMAIL ---------- */

function rpRapportHTML(r){

const client = (r.organizations && r.organizations.nom) || 'Client';
const codeClient = (r.organizations && r.organizations.code_client) || '';

const signature = rapports.urls[r.signature_path]
? `<img src="${rapports.urls[r.signature_path]}" style="max-width:320px;max-height:160px;">`
: '<p>Signature non disponible</p>';

return `
<!DOCTYPE html>
<html lang="fr">

<head>

<meta charset="UTF-8">

<title>Rapport d'intervention - ${esc(client)}</title>

<style>

body{
font-family:Arial,sans-serif;
margin:40px;
color:#222;
}

h1{
text-align:center;
margin-bottom:30px;
}

.info{
border:1px solid #ccc;
padding:15px;
margin-bottom:20px;
}

.raison{
border:1px solid #ccc;
padding:15px;
white-space:pre-wrap;
min-height:120px;
}

.signature{
margin-top:30px;
border-top:1px solid #ccc;
padding-top:15px;
}

</style>

</head>

<body>

<h1>RAPPORT D'INTERVENTION</h1>

<div class="info">

<p>
<strong>Client :</strong>
${esc(client)}
</p>

${codeClient ? `
<p>
<strong>N° client :</strong>
${esc(codeClient)}
</p>
` : ''}

<p>
<strong>Date :</strong>
${esc(fmtDate(r.date_intervention))}
</p>

<p>
<strong>Technicien :</strong>
${esc(r.nom_support || '')}
</p>

<p>
<strong>Destinataire :</strong>
${esc(r.email_destinataire || '')}
</p>

</div>

<h3>Raison / description de l'intervention</h3>

<div class="raison">
${esc(r.raison || '')}
</div>

<div class="signature">

<h3>Signature du client</h3>

${signature}

${r.nom_signataire ? `
<p>
<strong>Nom du signataire :</strong>
${esc(r.nom_signataire)}
</p>
` : ''}

</div>

<p style="margin-top:40px;font-size:12px;color:#777;">
Rapport généré par WiTracEQUIP
</p>

</body>

</html>
`;
}


/* ---------- CHARGEMENT DES URL DES FICHIERS ---------- */

async function rpChargerURLsRapport(r){

const chemins = [
r.signature_path,
...(r.pieces_jointes || []).map(p => p.chemin)
].filter(Boolean);

const manquants = chemins.filter(c => !rapports.urls[c]);

if(!manquants.length) return;

const { data, error } = await sb.storage
.from(BUCKET_RAPPORTS)
.createSignedUrls(manquants, 3600);

if(error) throw error;

(data || []).forEach(x => {

if(x.signedUrl){
rapports.urls[x.path] = x.signedUrl;
}

});

}


/* ---------- EXPORT PDF ---------- */

async function rpExporterPDF(id){

const r = (rapports.liste || []).find(x => x.id === id);

if(!r){
toast('Rapport introuvable.', 'erreur');
return;
}

try{

await rpChargerURLsRapport(r);

const fenetre = window.open('', '_blank');

if(!fenetre){

toast(
'Le navigateur a bloqué la fenêtre. Autorisez les fenêtres pop-up pour cette application.',
'erreur'
);

return;
}

fenetre.document.open();

fenetre.document.write(
rpRapportHTML(r)
);

fenetre.document.close();

fenetre.onload = () => {

setTimeout(() => {

fenetre.focus();

fenetre.print();

}, 300);

};

}
catch(e){

toast(
'Impossible de préparer le PDF : ' + (e.message || e),
'erreur'
);

}

}


/* ---------- PREPARER EMAIL ---------- */

async function rpPreparerEmail(id){

const r = (rapports.liste || []).find(x => x.id === id);

if(!r){

toast('Rapport introuvable.', 'erreur');

return;

}

const email = (r.email_destinataire || '').trim();

if(!email){

toast(
'Aucune adresse e-mail n’est enregistrée pour ce rapport.',
'erreur'
);

return;

}

const client =
(r.organizations && r.organizations.nom)
|| 'Client';

const sujet =
`Rapport d'intervention - ${client} - ${fmtDate(r.date_intervention)}`;

const message =
`Bonjour,

Veuillez trouver ci-joint le rapport d'intervention réalisé le ${fmtDate(r.date_intervention)}.

Client : ${client}
Technicien : ${r.nom_support || ''}

Nous restons à votre disposition pour toute information complémentaire.

Cordialement,
WiTracEQUIP`;

const url =
`mailto:${encodeURIComponent(email)}` +
`?subject=${encodeURIComponent(sujet)}` +
`&body=${encodeURIComponent(message)}`;

window.location.href = url;

}
/* ---------------------------------------------------------------------- */
