/* ---------------------------------------------------------------------- */
/* Support → Rapport d'intervention (fondateur)                            */
/* ---------------------------------------------------------------------- */
/* Un rapport = qui est intervenu (support), chez quel client, quand,
   pourquoi, la signature du client (dessinée au doigt) et des pièces jointes.
   Stockage : table « rapports_intervention » + bucket privé
   « rapports-intervention ». Tout est réservé au super-administrateur : la
   base le vérifie elle-même (RLS).

   v2.17.8 — refonte des actions sur un rapport :
   - Modifier : champs, signature (remplaçable) et documents (ajout / retrait)
   - Archiver / Restaurer, avec une vue « Archivés »
   - Exporter PDF : vrai fichier PDF (jsPDF), plus de fenêtre pop-up
   - Envoyer par e-mail : PDF + documents joints via la feuille de partage du
     téléphone ; sur ordinateur, PDF téléchargé + messagerie ouverte. */

const RP_VERSION = 'v2.17.8';
const BUCKET_RAPPORTS = 'rapports-intervention';
const RP_TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par document
const RP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RP_JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

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
signature: null,            // nouvelle signature dessinée (dataURL)
signatureExistante: null,   // chemin de la signature déjà enregistrée (modification)
fichiers: [],               // nouveaux documents (File)
piecesExistantes: [],       // documents déjà enregistrés (modification)
};
}

function rpEtatInitial(uid){
return { uid, form: rpFormVide(), modificationId: null, liste: null, listeLoading: false, listeError: '', vue: 'actifs', busy: false, occupe: null, error: '', ouvert: null, urls: {} };
}
let rapports = { uid: null, form: null };

function rpTrouver(id){ return (rapports.liste || []).find(x => x.id === id); }

/* ---------- Chargement de la liste ---------- */

function chargerRapports(force){
if(rapports.listeLoading) return;
if(rapports.liste !== null && !force) return;
if(rapports.listeError && !force) return; // pas de relance en boucle sur une erreur
const vue = rapports.vue;
rapports.listeLoading = true;
let q = sb.from('rapports_intervention')
.select('id, organization_id, nom_support, date_intervention, raison, nom_signataire, email_destinataire, signature_path, pieces_jointes, created_at, archived_at, organizations(nom, code_client)');
q = vue === 'archives' ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
q.order('date_intervention', { ascending: false })
.order('created_at', { ascending: false })
.limit(100)
.then(({ data, error }) => {
if(error) throw error;
// L'utilisateur a changé d'onglet pendant le chargement : on recharge la bonne vue.
if(rapports.vue !== vue){ rapports.liste = null; return; }
rapports.liste = data || []; rapports.listeError = '';
})
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
const modif = !!rapports.modificationId;
const clients = [...(reglages.clients || [])].filter(c => !c.est_mon_organisation)
.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

return `
<div class="card">
<h3 style="margin-bottom:10px;">${modif ? 'Modifier le rapport' : "Nouveau rapport d'intervention"}</h3>
${modif ? `<div class="hint" style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;">
Vous modifiez le rapport du ${esc(fmtDate(f.date))}. Rien n'est changé tant que vous n'avez pas cliqué sur « Enregistrer les modifications ».
<div style="margin-top:8px;"><button type="button" class="btn btn-sm" data-rp="annuler-modif">Annuler la modification</button></div>
</div>` : ''}
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
<input type="email" name="email_destinataire" data-rp="champ" value="${esc(f.email_destinataire)}" placeholder="exemple@entreprise.fr" autocomplete="email">
<div class="hint">Adresse de la personne qui recevra ce rapport. Elle peut être différente du contact principal du client.</div>
</div>
<div class="field"><label>Raison de l'intervention <span class="oblig">obligatoire</span></label>
<textarea name="raison" data-rp="champ" rows="4" placeholder="Décrivez la raison de l'intervention et ce qui a été fait…">${esc(f.raison)}</textarea></div>

<div class="field"><label>Documents joints <span class="muted small">(facultatif — PDF, photo, Word, Excel… 10 Mo max chacun)</span></label>
${f.piecesExistantes.map((x, i) => `
<div class="list-item" style="padding:8px 0;">
<div style="flex:1;min-width:0;overflow-wrap:anywhere;">${esc(x.nom)} <span class="small muted">· déjà enregistré${x.taille ? ' · ' + rpTaille(x.taille) : ''}</span></div>
<button type="button" class="btn btn-sm btn-danger" data-rp="retirer-existant" data-i="${i}">Retirer</button>
</div>`).join('')}
${f.fichiers.map((x, i) => `
<div class="list-item" style="padding:8px 0;">
<div style="flex:1;min-width:0;overflow-wrap:anywhere;">${esc(x.name)} <span class="small muted">· ${rpTaille(x.size)}</span></div>
<button type="button" class="btn btn-sm btn-danger" data-rp="retirer-fichier" data-i="${i}">Retirer</button>
</div>`).join('')}
<label class="btn btn-sm" style="margin-top:6px;cursor:pointer;">+ Joindre un document
<input type="file" multiple data-rp="fichiers" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" style="display:none;"></label>
</div>

<div class="field"><label>Signature du client ${modif ? '' : '<span class="oblig">obligatoire</span>'}</label>
${modif && f.signatureExistante && !f.signature ? `
<div class="hint" style="margin:0 0 6px;">Signature déjà enregistrée (conservée). Pour la remplacer, le client signe à nouveau dans le cadre ci-dessous.</div>
${rapports.urls[f.signatureExistante] ? `<img src="${esc(rapports.urls[f.signatureExistante])}" alt="Signature enregistrée" style="display:block;max-width:240px;width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">` : ''}
` : `<div class="hint" style="margin:0 0 6px;">Le client signe avec le doigt dans le cadre ci-dessous.</div>`}
<canvas id="rp-sig" style="display:block;width:100%;aspect-ratio:2/1;background:#fff;border:2px dashed var(--border);border-radius:10px;touch-action:none;"></canvas>
<div class="row between wrap" style="margin-top:6px;gap:8px;">
<input type="text" name="signataire" data-rp="champ" value="${esc(f.signataire)}" placeholder="Nom du signataire (facultatif)" style="flex:1;min-width:180px;">
<button type="button" class="btn btn-sm" data-rp="effacer">Effacer la signature</button>
</div></div>

<button class="btn btn-primary" type="submit" ${rapports.busy ? 'disabled' : ''}>${rapports.busy ? 'Enregistrement…' : (modif ? 'Enregistrer les modifications' : 'Enregistrer le rapport')}</button>
</form>
</div>

<div class="card">
<div class="row between wrap" style="margin-bottom:6px;">
<h3>Rapports ${rapports.vue === 'archives' ? 'archivés' : 'enregistrés'}</h3>
<button class="btn btn-sm" data-rp="actualiser">Actualiser</button>
</div>
<div class="row" style="gap:6px;margin-bottom:8px;">
<button class="btn btn-sm ${rapports.vue === 'actifs' ? 'btn-primary' : ''}" data-rp="vue" data-vue="actifs">Actifs</button>
<button class="btn btn-sm ${rapports.vue === 'archives' ? 'btn-primary' : ''}" data-rp="vue" data-vue="archives">Archivés</button>
</div>
${viewListeRapports()}
<div class="small muted" style="margin-top:10px;">Module rapports ${RP_VERSION}</div>
</div>`;
}

function viewListeRapports(){
if(rapports.listeError){
return `<div class="alert alert-error">${esc(rapports.listeError)}<br><span class="small">Si le message parle d'une table introuvable, le fichier SQL « rapports_intervention.sql » n'a pas encore été exécuté dans Supabase.</span></div>`;
}
if(rapports.liste === null) return squeletteListe(3);
if(!rapports.liste.length) return `<div class="empty small">${rapports.vue === 'archives' ? 'Aucun rapport archivé.' : 'Aucun rapport pour l\'instant.'}</div>`;
const archives = rapports.vue === 'archives';
return rapports.liste.map(r => {
const ouvert = rapports.ouvert === r.id;
const pj = r.pieces_jointes || [];
const occupe = rapports.occupe === r.id;
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

<div class="small muted" style="margin-top:8px;"><strong>Destinataire :</strong> ${r.email_destinataire ? esc(r.email_destinataire) : 'Non renseigné'}</div>

<div class="small muted" style="margin-top:8px;">Signature${r.nom_signataire ? ' de ' + esc(r.nom_signataire) : ' du client'} :</div>
${rapports.urls[r.signature_path]
? `<img src="${esc(rapports.urls[r.signature_path])}" alt="Signature" style="display:block;max-width:320px;width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;margin-top:4px;">`
: `<div class="small muted">Chargement…</div>`}
${pj.length ? `<div class="small muted" style="margin-top:10px;">Documents joints :</div>
${pj.map(p => rapports.urls[p.chemin]
? `<div><a href="${esc(rapports.urls[p.chemin])}" target="_blank" rel="noopener">${esc(p.nom)}</a></div>`
: `<div class="small muted">${esc(p.nom)} …</div>`).join('')}` : ''}
<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
${archives ? '' : `<button class="btn btn-sm" data-rp="modifier" data-id="${r.id}">Modifier</button>`}
${archives
? `<button class="btn btn-sm" data-rp="restaurer" data-id="${r.id}">Restaurer</button>`
: `<button class="btn btn-sm" data-rp="archiver" data-id="${r.id}">Archiver</button>`}
<button class="btn btn-sm" data-rp="exporter" data-id="${r.id}" ${rapports.occupe ? 'disabled' : ''}>${occupe ? 'Préparation…' : 'Exporter PDF'}</button>
<button class="btn btn-sm" data-rp="email" data-id="${r.id}" ${rapports.occupe ? 'disabled' : ''}>${occupe ? 'Préparation…' : 'Envoyer par e-mail'}</button>
<button class="btn btn-sm btn-danger" data-rp="supprimer" data-id="${r.id}">Supprimer ce rapport</button>
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
   est donc conservée en mémoire (dataURL) et repeinte sur le nouveau canvas.
   Seules des signatures dessinées ici (dataURL) sont repeintes — jamais une
   image distante, qui « salirait » le canvas et bloquerait toDataURL(). */
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
try{ if(rapports.form) rapports.form.signature = rpDessin.c.toDataURL('image/png'); }catch(_){}
rpDessin = null;
}
document.addEventListener('pointerup', rpFinDessin);
document.addEventListener('pointercancel', rpFinDessin);

/* ---------- Utilitaires ---------- */

function rpDataUrlVersBlob(u){
const [tete, corps] = u.split(',');
const mime = (/:(.*?);/.exec(tete) || [])[1] || 'image/png';
const bin = atob(corps);
const a = new Uint8Array(bin.length);
for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
return new Blob([a], { type: mime });
}

function rpBlobVersDataUrl(blob){
return new Promise((resolve, reject) => {
const fr = new FileReader();
fr.onload = () => resolve(fr.result);
fr.onerror = () => reject(fr.error || new Error('Lecture du fichier impossible'));
fr.readAsDataURL(blob);
});
}

/* Nom de fichier sans accents ni caractères que le stockage refuse. */
function rpNomSur(nom){
return String(nom).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'document';
}

function rpValider(f, creation){
return !f.nom_support.trim() ? 'Indiquez le nom du support.'
: !f.client_id ? 'Choisissez un client.'
: !f.date ? "Indiquez la date de l'intervention."
: !f.raison.trim() ? "Indiquez la raison de l'intervention."
: !f.email_destinataire.trim() ? "Indiquez l'adresse e-mail du destinataire."
: !RP_EMAIL_RE.test(f.email_destinataire.trim()) ? "L'adresse e-mail indiquée n'est pas valide."
: (creation && !f.signature) ? 'La signature du client est obligatoire.' : '';
}

function rpRetourFormulaire(erreur){
rapports.error = erreur;
render();
window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Enregistrement d'un nouveau rapport ---------- */

async function rpEnregistrer(){
if(rapports.busy) return;
const f = rapports.form;
const erreur = rpValider(f, true);
if(erreur) return rpRetourFormulaire(erreur);

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
const r = rpTrouver(id);
if(!r) return;
try{ await rpChargerURLsRapport(r); }
catch(e){ toast('Impossible de charger les fichiers : ' + (e.message || e), 'erreur'); return; }
render();
}

/* URLs signées (1 h) de la signature et des documents d'un rapport. */
async function rpChargerURLsRapport(r){
const chemins = [r.signature_path, ...(r.pieces_jointes || []).map(p => p.chemin)].filter(Boolean);
const manquants = chemins.filter(c => !rapports.urls[c]);
if(!manquants.length) return;
const { data, error } = await sb.storage.from(BUCKET_RAPPORTS).createSignedUrls(manquants, 3600);
if(error) throw error;
(data || []).forEach(x => { if(x.signedUrl) rapports.urls[x.path] = x.signedUrl; });
}

/* ---------- MODIFIER ---------- */

async function rpModifier(id){
const r = rpTrouver(id);
if(!r){ toast('Rapport introuvable. Actualisez la liste.', 'erreur'); return; }

try{ await rpChargerURLsRapport(r); }catch(_){ /* l'aperçu de la signature est facultatif */ }

rapports.form = {
nom_support: r.nom_support || '',
client_id: r.organization_id || '',
date: r.date_intervention || rpAujourdhui(),
raison: r.raison || '',
signataire: r.nom_signataire || '',
email_destinataire: r.email_destinataire || '',
signature: null,
signatureExistante: r.signature_path || null,
fichiers: [],
piecesExistantes: (r.pieces_jointes || []).map(p => ({ ...p })),
};
rapports.modificationId = id;
rapports.error = '';
render();
window.scrollTo({ top: 0, behavior: 'smooth' });
toast('Rapport chargé : modifiez puis enregistrez', 'info');
}

function rpAnnulerModification(){
rapports.modificationId = null;
rapports.form = rpFormVide();
rapports.error = '';
render();
}

async function rpEnregistrerModification(){
const id = rapports.modificationId;
if(!id) return rpEnregistrer();
if(rapports.busy) return;

const f = rapports.form;
const original = rpTrouver(id);
if(!original) return rpRetourFormulaire("Ce rapport n'est plus dans la liste : actualisez puis recommencez.");
const erreur = rpValider(f, false);
if(erreur) return rpRetourFormulaire(erreur);

rapports.busy = true; rapports.error = ''; render();

// Les nouveaux fichiers vont dans le dossier existant du rapport.
const dossier = (original.signature_path || '').split('/').slice(0, -1).join('/') || `${original.organization_id}/${id}`;
const horodatage = Date.now();
const envoyes = [];
try{
let cheminSig = original.signature_path;
let ancienneSignature = null;
if(f.signature){
cheminSig = `${dossier}/signature-${horodatage}.png`;
const r = await sb.storage.from(BUCKET_RAPPORTS).upload(cheminSig, rpDataUrlVersBlob(f.signature), { contentType: 'image/png', upsert: false });
if(r.error) throw r.error;
envoyes.push(cheminSig);
ancienneSignature = original.signature_path;
}

const pieces = f.piecesExistantes.map(p => ({ ...p }));
for(const [i, fichier] of f.fichiers.entries()){
const chemin = `${dossier}/pj-${horodatage}-${i + 1}-${rpNomSur(fichier.name)}`;
const r = await sb.storage.from(BUCKET_RAPPORTS).upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream', upsert: false });
if(r.error) throw r.error;
envoyes.push(chemin);
pieces.push({ chemin, nom: fichier.name, taille: fichier.size, type: fichier.type || '' });
}

const { data, error } = await sb.from('rapports_intervention').update({
organization_id: f.client_id,
nom_support: f.nom_support.trim(),
date_intervention: f.date,
raison: f.raison.trim(),
nom_signataire: f.signataire.trim() || null,
email_destinataire: f.email_destinataire.trim(),
signature_path: cheminSig,
pieces_jointes: pieces,
}).eq('id', id).select('id');
if(error) throw error;
// La base peut « réussir » sans rien modifier si un droit manque : on le vérifie.
if(!data || !data.length) throw new Error("la base a refusé la modification (aucune ligne modifiée).");

// Modification acquise : on efface les fichiers devenus inutiles (sans bloquer si ça échoue).
const gardes = new Set(pieces.map(p => p.chemin));
const aEffacer = (original.pieces_jointes || []).map(p => p.chemin).filter(c => c && !gardes.has(c));
if(ancienneSignature) aEffacer.push(ancienneSignature);
if(aEffacer.length) sb.storage.from(BUCKET_RAPPORTS).remove(aEffacer).catch(() => {});

rapports.modificationId = null;
rapports.form = rpFormVide();
rapports.liste = null;
rapports.ouvert = id;
toast('Rapport modifié');
}catch(e){
if(envoyes.length) sb.storage.from(BUCKET_RAPPORTS).remove(envoyes).catch(() => {});
rapports.error = 'Modification impossible : ' + (e.message || e);
}finally{
rapports.busy = false; render();
if(rapports.error) window.scrollTo({ top: 0, behavior: 'smooth' });
}
}

/* ---------- ARCHIVER / RESTAURER ---------- */

async function rpChangerArchivage(id, archiver){
const r = rpTrouver(id);
if(!r) return;
if(archiver && !await confirmer(
'Archiver ce rapport ?\n\nLe rapport n\'est pas supprimé : il reste consultable dans l\'onglet « Archivés » et peut être restauré.',
{ ok: 'Archiver' }
)) return;

try{
const { data, error } = await sb.from('rapports_intervention')
.update({ archived_at: archiver ? new Date().toISOString() : null })
.eq('id', id).select('id');
if(error) throw error;
if(!data || !data.length) throw new Error("la base a refusé l'opération (aucune ligne modifiée).");

rapports.liste = rapports.liste.filter(x => x.id !== id);
rapports.ouvert = null;
if(rapports.modificationId === id) rapports.modificationId = null;
toast(archiver ? 'Rapport archivé' : 'Rapport restauré');
}catch(e){
toast((archiver ? 'Archivage impossible : ' : 'Restauration impossible : ') + (e.message || e), 'erreur');
}
render();
}

/* ---------- SUPPRIMER ---------- */

async function rpSupprimer(id){
const r = rpTrouver(id);
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
if(rapports.modificationId === id) rpAnnulerModification();
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

/* ---------- PDF ---------- */

/* jsPDF est chargé à la demande : il ne pèse rien tant qu'on n'exporte pas. */
function rpChargerJsPDF(){
if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
return new Promise((resolve, reject) => {
const s = document.createElement('script');
s.src = RP_JSPDF_URL;
s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error('module PDF introuvable'));
s.onerror = () => reject(new Error("impossible de charger le module PDF (pas de connexion ?)"));
document.head.appendChild(s);
});
}

/* Les polices standard d'un PDF ne connaissent que le Latin-1 : on remplace le reste. */
function rpTxt(s){
return String(s == null ? '' : s)
.replace(/\r\n?/g, '\n')
.replace(/\t/g, '    ')
.replace(/[\u2018\u2019\u02BC]/g, "'")
.replace(/[\u201C\u201D]/g, '"')
.replace(/[\u2013\u2014]/g, '-')
.replace(/\u2026/g, '...')
.replace(/\u20AC/g, ' EUR')
.replace(/[\u202F\u2009\u200A]/g, ' ')
.replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, '?');
}

async function rpConstruirePDF(r){
const JsPDF = await rpChargerJsPDF();
const doc = new JsPDF({ unit: 'mm', format: 'a4' });
const L = 18, LARG = 210 - 2 * L, BAS = 285;
const client = (r.organizations && r.organizations.nom) || 'Client';
const code = (r.organizations && r.organizations.code_client) || '';
let y;

// Bandeau de titre
doc.setFillColor(15, 118, 110); doc.rect(0, 0, 210, 28, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
doc.text("RAPPORT D'INTERVENTION", L, 17);
doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
doc.text('WiTracEQUIP', 210 - L, 17, { align: 'right' });
doc.setTextColor(34, 34, 34);
y = 40;

// Informations
const infos = [
['Client', client],
code ? ['N° client', code] : null,
['Date', fmtDate(r.date_intervention)],
['Intervenant', r.nom_support || ''],
['Destinataire', r.email_destinataire || ''],
].filter(Boolean);
doc.setFontSize(10.5);
for(const [etiquette, valeur] of infos){
const lignes = doc.splitTextToSize(rpTxt(valeur) || '-', LARG - 34);
doc.setFont('helvetica', 'bold'); doc.text(rpTxt(etiquette) + ' :', L, y);
doc.setFont('helvetica', 'normal'); doc.text(lignes, L + 34, y);
y += 5.6 * lignes.length + 1.6;
}
y += 4;

// Raison / description (avec sauts de page)
doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
doc.text("Raison / description de l'intervention", L, y);
y += 3;
doc.setDrawColor(200, 200, 200); doc.line(L, y, L + LARG, y);
y += 6;
doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
for(const ligne of doc.splitTextToSize(rpTxt(r.raison) || '-', LARG)){
if(y > BAS){ doc.addPage(); y = 20; }
doc.text(ligne, L, y);
y += 5.4;
}
y += 8;

// Signature
if(r.signature_path){
let data = null;
try{
const { data: blob, error } = await sb.storage.from(BUCKET_RAPPORTS).download(r.signature_path);
if(error) throw error;
data = await rpBlobVersDataUrl(blob);
}catch(_){ data = null; }
if(y > BAS - 60){ doc.addPage(); y = 20; }
doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
doc.text('Signature du client', L, y);
y += 5;
if(data){
let w = 70, h = 35;
try{
const p = doc.getImageProperties(data);
if(p && p.width && p.height){ h = w * p.height / p.width; if(h > 40){ h = 40; w = h * p.width / p.height; } }
}catch(_){}
doc.setDrawColor(200, 200, 200); doc.rect(L, y, w, h);
doc.addImage(data, 'PNG', L, y, w, h);
y += h + 5;
}else{
doc.setFont('helvetica', 'italic'); doc.setFontSize(10);
doc.text('Signature non disponible', L, y + 4);
y += 10;
}
if(r.nom_signataire){
doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
doc.text('Signataire : ' + rpTxt(r.nom_signataire), L, y);
y += 6;
}
}

// Documents joints (liste)
const pj = r.pieces_jointes || [];
if(pj.length){
y += 4;
if(y > BAS - 20){ doc.addPage(); y = 20; }
doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
doc.text('Documents joints', L, y);
y += 6;
doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
for(const p of pj){
for(const ligne of doc.splitTextToSize('- ' + rpTxt(p.nom), LARG)){
if(y > BAS){ doc.addPage(); y = 20; }
doc.text(ligne, L, y);
y += 5;
}
}
}

// Pied de page
const n = doc.getNumberOfPages();
for(let i = 1; i <= n; i++){
doc.setPage(i);
doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
doc.text(`Rapport généré par WiTracEQUIP - page ${i}/${n}`, 105, 291, { align: 'center' });
}

const nom = `Rapport_intervention_${rpNomSur(client)}_${r.date_intervention || 'sans-date'}.pdf`;
return new File([doc.output('blob')], nom, { type: 'application/pdf' });
}

/* Les documents joints au rapport, récupérés depuis le stockage privé. */
async function rpTelechargerPieces(r){
const fichiers = [], manquants = [];
for(const p of (r.pieces_jointes || [])){
try{
const { data, error } = await sb.storage.from(BUCKET_RAPPORTS).download(p.chemin);
if(error) throw error;
fichiers.push(new File([data], p.nom || 'document', { type: p.type || data.type || 'application/octet-stream' }));
}catch(_){ manquants.push(p.nom || 'document'); }
}
return { fichiers, manquants };
}

function rpTelecharger(fichier){
const url = URL.createObjectURL(fichier);
const a = document.createElement('a');
a.href = url; a.download = fichier.name;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function rpEstMobile(){
return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
|| (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''));
}

function rpPeutPartager(fichiers){
try{ return !!(navigator.share && navigator.canShare && navigator.canShare({ files: fichiers })); }
catch(_){ return false; }
}

/* ---------- EXPORTER PDF ---------- */

async function rpExporterPDF(id){
const r = rpTrouver(id);
if(!r){ toast('Rapport introuvable. Actualisez la liste.', 'erreur'); return; }
if(rapports.occupe) return;
rapports.occupe = id; render();
let pdf;
try{ pdf = await rpConstruirePDF(r); }
catch(e){ toast('Impossible de préparer le PDF : ' + (e.message || e), 'erreur'); }
rapports.occupe = null; render();
if(!pdf) return;

// Téléphone : feuille de partage (Enregistrer dans Fichiers, Drive, WhatsApp…).
// Elle exige un geste de l'utilisateur, d'où cette confirmation.
if(rpEstMobile() && rpPeutPartager([pdf])){
if(!await confirmer('PDF prêt\n\n' + pdf.name, { ok: 'Enregistrer / partager' })) return;
try{ await navigator.share({ files: [pdf], title: pdf.name }); return; }
catch(e){ if(e && e.name === 'AbortError') return; }
}
rpTelecharger(pdf);
toast('PDF téléchargé : ' + pdf.name);
}

/* ---------- ENVOYER PAR E-MAIL ---------- */

async function rpPreparerEmail(id){
const r = rpTrouver(id);
if(!r){ toast('Rapport introuvable. Actualisez la liste.', 'erreur'); return; }
const email = (r.email_destinataire || '').trim();
if(!RP_EMAIL_RE.test(email)){
toast("Aucune adresse e-mail valide n'est enregistrée pour ce rapport. Utilisez « Modifier » pour la renseigner.", 'erreur');
return;
}
if(rapports.occupe) return;

rapports.occupe = id; render();
let pdf, pieces = { fichiers: [], manquants: [] };
try{
pdf = await rpConstruirePDF(r);
pieces = await rpTelechargerPieces(r);
}catch(e){ toast("Impossible de préparer l'e-mail : " + (e.message || e), 'erreur'); }
rapports.occupe = null; render();
if(!pdf) return;

const client = (r.organizations && r.organizations.nom) || 'Client';
const sujet = `Rapport d'intervention - ${client} - ${fmtDate(r.date_intervention)}`;
const corps = `Bonjour,

Veuillez trouver ci-joint le rapport d'intervention réalisé le ${fmtDate(r.date_intervention)}.

Client : ${client}
Intervenant : ${r.nom_support || ''}

Nous restons à votre disposition pour toute information complémentaire.

Cordialement,
${r.nom_support || 'WiTracEQUIP'}`;

const tous = [pdf, ...pieces.fichiers];
const avertissement = pieces.manquants.length
? `\n\nAttention : ${pieces.manquants.length} document(s) joint(s) n'ont pas pu être récupérés (${pieces.manquants.join(', ')}). Le PDF du rapport est bien inclus.` : '';

// --- Téléphone : la feuille de partage ouvre la messagerie AVEC les pièces jointes.
if(rpEstMobile() && (rpPeutPartager(tous) || rpPeutPartager([pdf]))){
const nb = pieces.fichiers.length;
if(!await confirmer(
`Rapport prêt à envoyer\n\nDestinataire : ${email}\n\nLe PDF${nb ? ' et ' + nb + ' document' + (nb > 1 ? 's' : '') : ''} vont être joints. Choisissez votre messagerie dans la liste qui s'ouvre, puis saisissez l'adresse du destinataire (elle vient d'être copiée).${avertissement}`,
{ ok: 'Ouvrir la messagerie' }
)) return;
try{ if(navigator.clipboard) await navigator.clipboard.writeText(email); }catch(_){}
const lots = rpPeutPartager(tous) ? [tous, [pdf]] : [[pdf]];
for(const fichiers of lots){
try{ await navigator.share({ files: fichiers, title: sujet, text: corps }); return; }
catch(e){ if(e && e.name === 'AbortError') return; }
}
// Le partage a échoué partout : on retombe sur la méthode « ordinateur » ci-dessous.
}

// --- Ordinateur (ou partage indisponible) : PDF téléchargé + messagerie ouverte.
if(!await confirmer(
`Envoyer le rapport par e-mail\n\nLe PDF va être téléchargé, puis votre messagerie s'ouvrira avec le destinataire (${email}), l'objet et le message déjà remplis. Il ne restera qu'à joindre le PDF téléchargé${pieces.fichiers.length ? ' ainsi que les documents joints (à récupérer depuis « Voir »)' : ''}.${avertissement}`,
{ ok: 'Télécharger et ouvrir la messagerie' }
)) return;
rpTelecharger(pdf);
setTimeout(() => {
window.location.href = `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}, 500);
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
const id = t.dataset.id;

if(a === 'effacer'){ rapports.form.signature = null; rpPreparerCanvas(); }
else if(a === 'retirer-fichier'){ rapports.form.fichiers.splice(+t.dataset.i, 1); render(); }
else if(a === 'retirer-existant'){ rapports.form.piecesExistantes.splice(+t.dataset.i, 1); render(); }
else if(a === 'ouvrir') rpOuvrir(id);
else if(a === 'modifier') rpModifier(id);
else if(a === 'annuler-modif') rpAnnulerModification();
else if(a === 'archiver') rpChangerArchivage(id, true);
else if(a === 'restaurer') rpChangerArchivage(id, false);
else if(a === 'supprimer') rpSupprimer(id);
else if(a === 'exporter') rpExporterPDF(id);
else if(a === 'email') rpPreparerEmail(id);
else if(a === 'vue'){
if(rapports.vue !== t.dataset.vue){
rapports.vue = t.dataset.vue; rapports.liste = null; rapports.listeError = ''; rapports.ouvert = null;
render();
}
}
else if(a === 'actualiser'){ rapports.listeError = ''; chargerRapports(true); }
});

document.addEventListener('submit', (e) => {
if(e.target && e.target.id === 'rp-form'){
e.preventDefault();
rapports.modificationId ? rpEnregistrerModification() : rpEnregistrer();
}
});
/* ---------------------------------------------------------------------- */
