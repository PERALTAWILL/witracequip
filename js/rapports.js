/* ---------------------------------------------------------------------- */
/* Support → Rapport d'intervention (fondateur)                            */
/* ---------------------------------------------------------------------- */
/* Un rapport = qui est intervenu (support), chez quel client, quand,
   pourquoi, la signature du client (dessinée au doigt) et des pièces jointes.
   Stockage : table « rapports_intervention » + bucket privé
   « rapports-intervention ». Tout est réservé au super-administrateur : la
   base le vérifie elle-même (RLS).

   v2.17.16 — sélection multiple dans la liste : tout sélectionner, archiver /
   restaurer, supprimer ou exporter (un seul ZIP de PDF) plusieurs rapports.

   v2.17.15 — plus aucun champ obligatoire (adresse e-mail vérifiée seulement si
   elle est saisie) ; le client se tape librement ou se choisit dans la liste
   (sql/13-rapports-champs-libres.sql).

   v2.17.14 — PDF pleine page A4 : le compte rendu s'étend (lignes de
   rédaction) jusqu'aux blocs de fin, référence du rapport, mention de
   validation client.

   v2.17.13 — direction bleu nuit et ambre, avec panneaux client et
   validation assortis au bandeau supérieur.

   v2.17.12 — seconde direction graphique du PDF.

   v2.17.11 — première mise en page du PDF.

   v2.17.8 — refonte des actions sur un rapport :
   - Modifier : champs, signature (remplaçable) et documents (ajout / retrait)
   - Archiver / Restaurer, avec une vue « Archivés »
   - Exporter PDF : vrai fichier PDF (jsPDF), plus de fenêtre pop-up
   - Envoyer par e-mail : PDF + documents joints via la feuille de partage du
     téléphone ; sur ordinateur, PDF téléchargé + messagerie ouverte. */

const RP_VERSION = 'v2.17.16';
const BUCKET_RAPPORTS = 'rapports-intervention';
const RP_TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo par document
const RP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RP_JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const RP_JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function rpAujourdhui(){
const d = new Date();
return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function rpFormVide(){
return {
nom_support: ((state.profile && state.profile.full_name) || '').trim() || (state.session && state.session.user.email) || '',
client_id: '',
client_nom: '',            // texte tapé (ou nom choisi dans la liste)
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

/* Clients proposés dans la liste. Deux clients de même nom se distinguent par leur numéro. */
function rpClientsListe(){
const l = [...(reglages.clients || [])].filter(c => !c.est_mon_organisation)
.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
const norm = x => String(x || '').trim().toLowerCase();
const nb = {}; l.forEach(c => { nb[norm(c.nom)] = (nb[norm(c.nom)] || 0) + 1; });
return l.map(c => ({ id: c.id, nom: c.nom, code: c.code_client || '',
label: (nb[norm(c.nom)] > 1 && c.code_client) ? `${c.nom} — n° ${c.code_client}` : c.nom }));
}

/* Le texte tapé correspond-il à un client de la liste ? Si oui on le rattache, sinon nom libre. */
function rpResoudreClient(texte){
const t = String(texte || '').trim().toLowerCase();
if(!t) return '';
const c = rpClientsListe().find(x => x.label.toLowerCase() === t);
return c ? c.id : '';
}

/* Nom du client à afficher : client de la liste, sinon nom saisi. */
function rpNomClient(r){
return String((r.organizations && r.organizations.nom) || r.client_nom || '').trim() || 'Client';
}

function rpEtatInitial(uid){
return { uid, form: rpFormVide(), modificationId: null, liste: null, listeLoading: false, listeError: '', vue: 'actifs', sel: [], progression: '', busy: false, occupe: null, error: '', ouvert: null, urls: {} };
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
.select('id, organization_id, nom_support, date_intervention, raison, nom_signataire, email_destinataire, signature_path, pieces_jointes, client_nom, created_at, archived_at, organizations(nom, code_client)');
q = vue === 'archives' ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
q.order('date_intervention', { ascending: false })
.order('created_at', { ascending: false })
.limit(500)
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
const clients = rpClientsListe();

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
<div class="field"><label>Nom du support <span class="muted small">(facultatif)</span></label>
<input type="text" name="nom_support" data-rp="champ" value="${esc(f.nom_support)}" placeholder="Qui a réalisé l'intervention ?"></div>
<div class="field"><label>Date de l'intervention <span class="muted small">(facultatif)</span></label>
<input type="date" name="date" data-rp="champ" value="${esc(f.date)}"></div>
</div>
<div class="field"><label>Client <span class="muted small">(facultatif — tapez un nom ou choisissez dans la liste)</span></label>
<input type="text" name="client_nom" data-rp="champ" list="rp-clients" value="${esc(f.client_nom)}" placeholder="${clients.length ? 'Nom du client ou choisir dans la liste' : 'Nom du client'}" autocomplete="off">
<datalist id="rp-clients">${clients.map(c => `<option value="${esc(c.label)}">${c.code ? 'n° ' + esc(c.code) : ''}</option>`).join('')}</datalist>
<div class="hint" id="rp-client-hint">${f.client_id ? 'Client de la liste sélectionné.' : (f.client_nom.trim() ? 'Nom saisi à la main (client hors liste).' : 'Effacez le champ pour voir toute la liste.')}</div></div>
<div class="field">
<label>Adresse e-mail du destinataire <span class="muted small">(facultatif)</span></label>
<input type="email" name="email_destinataire" data-rp="champ" value="${esc(f.email_destinataire)}" placeholder="exemple@entreprise.fr" autocomplete="email">
<div class="hint">Adresse de la personne qui recevra ce rapport. Elle peut être différente du contact principal du client.</div>
</div>
<div class="field"><label>Raison de l'intervention <span class="muted small">(facultatif)</span></label>
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
<input type="file" multiple data-rp="fichiers" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" style="display:none;">
</label>
</div>

<div class="field"><label>Signature du client <span class="muted small">(facultatif)</span></label>
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
const sel = new Set(rpSelIds());
const nb = sel.size, total = rapports.liste.length;
const occupeLot = rapports.occupe === 'lot';
const barre = `
<div class="row between wrap" style="gap:8px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:6px;">
<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
<input type="checkbox" data-rp="sel-tout" ${nb === total ? 'checked' : ''} ${rapports.occupe ? 'disabled' : ''} style="width:18px;height:18px;">
Tout sélectionner (${total})</label>
<div class="small muted">${nb ? nb + ' sélectionné' + (nb > 1 ? 's' : '') : 'Aucune sélection'}</div>
</div>
${nb ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;">
<button class="btn btn-sm" data-rp="lot-exporter" ${rapports.occupe ? 'disabled' : ''}>${occupeLot ? 'Export ' + esc(rapports.progression || '…') : 'Exporter (' + nb + ')'}</button>
<button class="btn btn-sm" data-rp="${archives ? 'lot-restaurer' : 'lot-archiver'}" ${rapports.occupe ? 'disabled' : ''}>${archives ? 'Restaurer' : 'Archiver'} (${nb})</button>
<button class="btn btn-sm btn-danger" data-rp="lot-supprimer" ${rapports.occupe ? 'disabled' : ''}>Supprimer (${nb})</button>
<button class="btn btn-sm" data-rp="sel-vider" ${rapports.occupe ? 'disabled' : ''}>Désélectionner</button>
</div>` : ''}`;
return barre + rapports.liste.map(r => {
const ouvert = rapports.ouvert === r.id;
const pj = r.pieces_jointes || [];
const occupe = rapports.occupe === r.id;
return `
<div class="list-item" style="flex-wrap:wrap;align-items:flex-start;">
<input type="checkbox" data-rp="sel" data-id="${r.id}" ${sel.has(r.id) ? 'checked' : ''} ${rapports.occupe ? 'disabled' : ''} aria-label="Sélectionner ce rapport" style="width:18px;height:18px;margin:3px 10px 0 0;flex:none;">
<div style="flex:1;min-width:180px;">
<div style="font-weight:650;">${esc(rpNomClient(r))}</div>
<div class="small muted">${fmtDate(r.date_intervention)}${r.nom_support ? ' · par ' + esc(r.nom_support) : ''}${pj.length ? ` · ${pj.length} document${pj.length > 1 ? 's' : ''}` : ''}</div>
</div>
<button class="btn btn-sm" data-rp="ouvrir" data-id="${r.id}">${ouvert ? 'Masquer' : 'Voir'}</button>
${ouvert ? `
<div style="flex-basis:100%;padding-top:8px;">
<div style="white-space:pre-wrap;overflow-wrap:anywhere;">${r.raison ? esc(r.raison) : '<span class="muted">Aucune raison renseignée.</span>'}</div>

<div class="small muted" style="margin-top:8px;"><strong>Destinataire :</strong> ${r.email_destinataire ? esc(r.email_destinataire) : 'Non renseigné'}</div>

${r.signature_path ? `<div class="small muted" style="margin-top:8px;">Signature${r.nom_signataire ? ' de ' + esc(r.nom_signataire) : ' du client'} :</div>
${rapports.urls[r.signature_path]
? `<img src="${esc(rapports.urls[r.signature_path])}" alt="Signature" style="display:block;max-width:320px;width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;margin-top:4px;">`
: `<div class="small muted">Chargement…</div>`}` : `<div class="small muted" style="margin-top:8px;">Pas de signature${r.nom_signataire ? ' (signataire : ' + esc(r.nom_signataire) + ')' : ''}.</div>`}
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
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.strokeStyle = '#111';
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

function rpValider(f){
// Plus aucun champ obligatoire : on ne vérifie que le format de l'e-mail s'il est saisi.
const mail = f.email_destinataire.trim();
return (mail && !RP_EMAIL_RE.test(mail)) ? "L'adresse e-mail indiquée n'est pas valide." : '';
}

/* Si la base n'a pas encore reçu le script SQL 13, on l'explique clairement. */
function rpAideSql(e){
const m = String((e && e.message) || e || '');
return /client_nom|null value in column|not-null/i.test(m)
? "\n→ Exécutez d'abord le fichier sql/13-rapports-champs-libres.sql dans Supabase (SQL Editor)." : '';
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
const erreur = rpValider(f);
if(erreur) return rpRetourFormulaire(erreur);

rapports.busy = true; rapports.error = ''; render();
const id = idAleatoire();
const dossier = `${f.client_id || 'sans-client'}/${id}`;
const envoyes = [];
try{
let cheminSig = null, r;
if(f.signature){
cheminSig = `${dossier}/signature.png`;
r = await sb.storage.from(BUCKET_RAPPORTS).upload(cheminSig, rpDataUrlVersBlob(f.signature), { contentType: 'image/png', upsert: false });
if(r.error) throw r.error;
envoyes.push(cheminSig);
}

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
organization_id: f.client_id || null,
client_nom: f.client_id ? null : (f.client_nom.trim() || null),
nom_support: f.nom_support.trim() || null,
date_intervention: f.date || null,
raison: f.raison.trim() || null,
nom_signataire: f.signataire.trim() || null,
email_destinataire: f.email_destinataire.trim() || null,
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
rapports.error = "Enregistrement impossible : " + (e.message || e) + rpAideSql(e);
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
client_nom: (r.organizations && r.organizations.nom) || r.client_nom || '',
date: r.date_intervention || '',
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
const erreur = rpValider(f);
if(erreur) return rpRetourFormulaire(erreur);

rapports.busy = true; rapports.error = ''; render();

// Les nouveaux fichiers vont dans le dossier existant du rapport.
const cheminRef = original.signature_path || ((original.pieces_jointes || [])[0] || {}).chemin || '';
const dossier = cheminRef.split('/').slice(0, -1).join('/') || `${original.organization_id || 'sans-client'}/${id}`;
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
organization_id: f.client_id || null,
client_nom: f.client_id ? null : (f.client_nom.trim() || null),
nom_support: f.nom_support.trim() || null,
date_intervention: f.date || null,
raison: f.raison.trim() || null,
nom_signataire: f.signataire.trim() || null,
email_destinataire: f.email_destinataire.trim() || null,
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
rapports.error = 'Modification impossible : ' + (e.message || e) + rpAideSql(e);
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

/* ---------- SÉLECTION MULTIPLE : archiver, supprimer, exporter ---------- */

function rpSelIds(){
return (rapports.sel || []).filter(id => rpTrouver(id));
}

function rpSelBasculer(id, coche){
const s = new Set(rapports.sel || []);
if(coche) s.add(id); else s.delete(id);
rapports.sel = [...s];
}

function rpSelTout(coche){
rapports.sel = coche ? (rapports.liste || []).map(r => r.id) : [];
}

function rpLotArrete(){
rapports.occupe = null; rapports.progression = '';
}

async function rpLotArchiver(archiver){
const ids = rpSelIds();
if(!ids.length || rapports.occupe) return;
const n = ids.length, mot = n + ' rapport' + (n > 1 ? 's' : '');
if(archiver && !await confirmer(`Archiver ${mot} ?\n\nLes rapports ne sont pas supprimés : ils restent consultables dans l'onglet « Archivés » et peuvent être restaurés.`, { ok: 'Archiver' })) return;
if(!archiver && !await confirmer(`Restaurer ${mot} ?`, { ok: 'Restaurer' })) return;
rapports.occupe = 'lot'; render();
try{
const { data, error } = await sb.from('rapports_intervention')
.update({ archived_at: archiver ? new Date().toISOString() : null })
.in('id', ids).select('id');
if(error) throw error;
const faits = new Set((data || []).map(x => x.id));
if(!faits.size) throw new Error("la base a refusé l'opération (aucune ligne modifiée).");
rapports.liste = rapports.liste.filter(x => !faits.has(x.id));
rapports.sel = rapports.sel.filter(id => !faits.has(id));
rapports.ouvert = null;
if(rapports.modificationId && faits.has(rapports.modificationId)) rapports.modificationId = null;
if(faits.size < n) toast(`${faits.size} rapport(s) sur ${n} ${archiver ? 'archivé(s)' : 'restauré(s)'} — vérifiez les autres.`, 'erreur');
else toast(faits.size > 1 ? `${faits.size} rapports ${archiver ? 'archivés' : 'restaurés'}` : `Rapport ${archiver ? 'archivé' : 'restauré'}`);
}catch(e){
toast((archiver ? 'Archivage impossible : ' : 'Restauration impossible : ') + (e.message || e), 'erreur');
}
rpLotArrete(); render();
}

async function rpLotSupprimer(){
const ids = rpSelIds();
if(!ids.length || rapports.occupe) return;
const n = ids.length;
const tout = n === (rapports.liste || []).length;
if(!await confirmer(`Supprimer ${n} rapport${n > 1 ? 's' : ''} ?\n\n${tout ? 'TOUS les rapports de cette liste' : (n > 1 ? 'Ces rapports' : 'Ce rapport')} ${n > 1 || tout ? 'seront' : 'sera'} définitivement effacé${n > 1 || tout ? 's' : ''}, avec leurs signatures et leurs documents joints. Cette action est irréversible.`, { danger: true, ok: 'Supprimer ' + n + (n > 1 ? ' rapports' : ' rapport') })) return;
rapports.occupe = 'lot'; render();
try{
const cibles = ids.map(rpTrouver).filter(Boolean);
const chemins = cibles.flatMap(r => [r.signature_path, ...(r.pieces_jointes || []).map(p => p.chemin)]).filter(Boolean);
for(let i = 0; i < chemins.length; i += 100){
const { error: e1 } = await sb.storage.from(BUCKET_RAPPORTS).remove(chemins.slice(i, i + 100));
if(e1) throw e1;
}
const { data, error } = await sb.from('rapports_intervention').delete().in('id', ids).select('id');
if(error) throw error;
const faits = new Set((data || []).map(x => x.id));
rapports.liste = rapports.liste.filter(x => !faits.has(x.id));
rapports.sel = rapports.sel.filter(id => !faits.has(id));
rapports.ouvert = null;
if(rapports.modificationId && faits.has(rapports.modificationId)) rpAnnulerModification();
if(faits.size < n) toast(`${faits.size} rapport(s) supprimé(s) sur ${n} — actualisez la liste et réessayez.`, 'erreur');
else toast(faits.size > 1 ? `${faits.size} rapports supprimés` : 'Rapport supprimé');
}catch(e){ toast('Suppression impossible : ' + (e.message || e), 'erreur'); }
rpLotArrete(); render();
}

function rpChargerJsZip(){
if(window.JSZip) return Promise.resolve(window.JSZip);
return new Promise((resolve, reject) => {
const s = document.createElement('script');
s.src = RP_JSZIP_URL;
s.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('module ZIP introuvable'));
s.onerror = () => reject(new Error('impossible de charger le module ZIP (pas de connexion ?)'));
document.head.appendChild(s);
});
}

async function rpLotExporter(){
const ids = rpSelIds();
if(!ids.length || rapports.occupe) return;
if(ids.length === 1) return rpExporterPDF(ids[0]);
const cibles = ids.map(rpTrouver).filter(Boolean);
rapports.occupe = 'lot'; rapports.progression = '0 / ' + cibles.length; render();

const pdfs = [], echecs = [];
for(const [i, r] of cibles.entries()){
rapports.progression = `${i + 1} / ${cibles.length}`; render();
try{ pdfs.push(await rpConstruirePDF(r)); }
catch(e){ echecs.push(rpNomClient(r) + ' (' + (e.message || e) + ')'); }
}
rpLotArrete(); render();
if(!pdfs.length){ toast("Aucun PDF n'a pu être préparé : " + (echecs[0] || ''), 'erreur'); return; }

// Deux rapports du même client le même jour ne doivent pas s'écraser dans le ZIP.
const vus = {};
const nomUnique = (nom) => {
vus[nom] = (vus[nom] || 0) + 1;
return vus[nom] === 1 ? nom : nom.replace(/\.pdf$/i, '') + '_' + vus[nom] + '.pdf';
};

let livrable = null, mode = 'zip';
try{
const JSZip = await rpChargerJsZip();
const zip = new JSZip();
pdfs.forEach(f => zip.file(nomUnique(f.name), f));
const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
livrable = new File([blob], `Rapports_intervention_${rpAujourdhui()}.zip`, { type: 'application/zip' });
}catch(_){ mode = 'pdfs'; }

const info = echecs.length ? `\n\nAttention : ${echecs.length} rapport(s) n'ont pas pu être préparés (${echecs.join(', ')}).` : '';

if(mode === 'zip'){
if(rpEstMobile() && rpPeutPartager([livrable])){
if(!await confirmer(`Export prêt\n\n${pdfs.length} rapports dans un ZIP\n${livrable.name}${info}`, { ok: 'Enregistrer / partager' })) return;
try{ await navigator.share({ files: [livrable], title: livrable.name }); return; }
catch(e){ if(e && e.name === 'AbortError') return; }
}
rpTelecharger(livrable);
toast(`ZIP téléchargé : ${pdfs.length} rapports`);
if(echecs.length) toast(`${echecs.length} rapport(s) n'ont pas pu être exportés.`, 'erreur');
return;
}

// Repli : le module ZIP n'a pas pu être chargé → les PDF un par un.
if(rpEstMobile() && rpPeutPartager(pdfs)){
if(!await confirmer(`Export prêt\n\n${pdfs.length} PDF à enregistrer${info}`, { ok: 'Enregistrer / partager' })) return;
try{ await navigator.share({ files: pdfs, title: 'Rapports d\'intervention' }); return; }
catch(e){ if(e && e.name === 'AbortError') return; }
}
for(const f of pdfs){ rpTelecharger(f); await new Promise(ok => setTimeout(ok, 350)); }
toast(`${pdfs.length} PDF téléchargés (autorisez les téléchargements multiples si le navigateur le demande)`);
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

/* Les polices standard d'un PDF couvrent le Latin-1 : on normalise les signes
   typographiques rares sans abîmer les accents français. */
function rpTxt(s){
return String(s == null ? '' : s)
.replace(/\r\n?/g, '\n')
.replace(/\t/g, '    ')
.replace(/[\u2018\u2019\u02BC]/g, "'")
.replace(/[\u201C\u201D]/g, '"')
.replace(/[\u2013\u2014]/g, '-')
.replace(/\u2026/g, '...')
.replace(/\u20AC/g, ' EUR')
.replace(/\u2192/g, ' -> ')
.replace(/\u0152/g, 'OE').replace(/\u0153/g, 'oe')
.replace(/\u00C6/g, 'AE').replace(/\u00E6/g, 'ae')
.replace(/[\u202F\u2009\u200A\u00A0]/g, ' ')
.replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, '?');
}

/* Palette du passeport numérique : bleu nuit et ambre, portée par un fond
   nude et des surfaces ivoire. Elle reste stable quel que soit le thème écran. */
const RP_PDF_COULEURS = {
nuit: [24, 43, 59],
nuitBord: [48, 73, 93],
ambre: [239, 155, 49],
ambreClair: [255, 193, 102],
ambreFonce: [154, 91, 22],
bleuTexte: [52, 73, 88],
grisBleu: [201, 209, 216],
grisBleuClair: [82, 99, 114],
encre: [39, 53, 62],
muet: [109, 120, 128],
ligne: [217, 223, 226],
ivoire: [251, 250, 247],
sable: [255, 240, 215],
sableBord: [231, 207, 170],
blanc: [255, 255, 255],
fond: [247, 244, 238],
};
let rpLogoPDFPromise = null;

function rpLignesPDF(doc, valeur, largeur){
const texteBrut = rpTxt(valeur == null ? '' : valeur);
const texte = texteBrut.trim() ? texteBrut : '-';
const lignes = [];
for(const paragraphe of texte.split('\n')){
if(!paragraphe){ lignes.push(''); continue; }
const morceaux = doc.splitTextToSize(paragraphe, largeur);
lignes.push(...(Array.isArray(morceaux) ? morceaux : [morceaux]));
}
return lignes.length ? lignes : ['-'];
}

function rpArrondiPDF(doc, x, y, largeur, hauteur, rayon, style){
if(typeof doc.roundedRect === 'function') doc.roundedRect(x, y, largeur, hauteur, rayon, rayon, style);
else doc.rect(x, y, largeur, hauteur, style);
}

function rpMarquePDF(doc, logo, x, y, taille){
if(logo){
try{ doc.addImage(logo, 'PNG', x, y, taille, taille); return; }catch(_){}
}
// Repli vectoriel : petit rappel du pictogramme WiTracEQUIP si l'icône
// n'est pas disponible (export hors ligne, par exemple).
doc.setFillColor(...RP_PDF_COULEURS.ambre);
rpArrondiPDF(doc, x, y, taille, taille, 2.2, 'F');
doc.setFillColor(...RP_PDF_COULEURS.nuit);
const t = taille * 0.22, marge = taille * 0.2, ecart = taille * 0.12;
doc.rect(x + marge, y + marge, t, t, 'F');
doc.rect(x + marge + t + ecart, y + marge, t, t, 'F');
doc.rect(x + marge, y + marge + t + ecart, t, t, 'F');
doc.rect(x + marge + t + ecart, y + marge + t + ecart, t, t, 'F');
}

function rpChargerLogoPDF(){
if(!rpLogoPDFPromise){
rpLogoPDFPromise = (async () => {
try{
const chemin = typeof LOGO_DATA_URL === 'string' && LOGO_DATA_URL ? LOGO_DATA_URL : 'assets/icons/icon-192.png';
const reponse = await fetch(new URL(chemin, document.baseURI), { cache: 'force-cache' });
if(!reponse.ok) throw new Error('logo indisponible');
return await rpBlobVersDataUrl(await reponse.blob());
}catch(_){ rpLogoPDFPromise = null; return null; }
})();
}
return rpLogoPDFPromise;
}

async function rpLireSignaturePDF(chemin){
if(!chemin) return null;
try{
const { data, error } = await sb.storage.from(BUCKET_RAPPORTS).download(chemin);
if(error) throw error;
return await rpBlobVersDataUrl(data);
}catch(_){ return null; }
}

function rpDessinerEntetePDF(doc, logo, premierePage, date, ref){
const C = RP_PDF_COULEURS;
if(premierePage){
// Bandeau bleu nuit, date ambre et logo posé sur un cartouche clair.
doc.setFillColor(...C.nuit);
doc.rect(0, 0, 210, 54, 'F');
doc.setFillColor(...C.ambre);
doc.rect(0, 0, 210, 1.5, 'F');

doc.setFillColor(...C.blanc);
rpArrondiPDF(doc, 18, 8, 12, 12, 2.4, 'F');
rpMarquePDF(doc, logo, 18.7, 8.7, 10.6);
doc.setTextColor(...C.blanc);
doc.setFont('helvetica', 'bold'); doc.setFontSize(12.2);
doc.text('WiTracEQUIP', 34, 16);
doc.setFont('helvetica', 'normal'); doc.setFontSize(7.7);
doc.setTextColor(...C.grisBleu);
doc.text('by WiDIAG MQ  ·  Passeport numérique de vos équipements', 34, 22.5);

doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4);
doc.setTextColor(...C.ambreClair);
doc.text('COMPTE RENDU  /  MAINTENANCE', 18, 30.5);
doc.setFont('helvetica', 'bold'); doc.setFontSize(22.5);
doc.setTextColor(...C.blanc);
doc.text("Rapport d'intervention", 18, 45);

// Repère date façon éditoriale : jour dominant, mois et année en regard.
const xDate = 147, yDate = 8, lDate = 45, hDate = 37;
doc.setFillColor(...C.ambre); doc.setDrawColor(...C.sableBord); doc.setLineWidth(0.3);
rpArrondiPDF(doc, xDate, yDate, lDate, hDate, 2.5, 'FD');
doc.setFillColor(...C.nuit);
doc.rect(xDate + 0.5, yDate + 4, 1.2, hDate - 8, 'F');
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
doc.setTextColor(...C.nuit);
doc.text("DATE D'INTERVENTION", xDate + 7, yDate + 9);
const partiesDate = String(date || '—').replace(/,/g, '').trim().split(/\s+/);
const jourDate = partiesDate[0] || '—';
const moisBrut = partiesDate[1] || '';
const moisDate = moisBrut ? moisBrut.replace(/\.$/, '').toUpperCase() + '.' : '';
const anneeDate = partiesDate.slice(2).join(' ');
doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
doc.setTextColor(...C.nuit);
doc.text(rpTxt(jourDate), xDate + 7, yDate + 21);
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
if(moisDate) doc.text(rpTxt(moisDate), xDate + 21.5, yDate + 16);
if(anneeDate) doc.text(rpTxt(anneeDate), xDate + 21.5, yDate + 21);
doc.setDrawColor(...C.ambreFonce); doc.setLineWidth(0.18);
doc.line(xDate + 7, yDate + 25.5, xDate + lDate - 5, yDate + 25.5);
doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
doc.setTextColor(...C.bleuTexte);
doc.text('Réf. ' + rpTxt(ref || '-'), xDate + 7, yDate + 31);
return;
}

// Bandeau bleu nuit répété sur les pages suivantes.
doc.setFillColor(...C.nuit);
doc.rect(0, 0, 210, 27, 'F');
doc.setFillColor(...C.ambre);
doc.rect(0, 27, 210, 1.2, 'F');
doc.setFillColor(...C.blanc);
rpArrondiPDF(doc, 18, 5, 11, 11, 2.2, 'F');
rpMarquePDF(doc, logo, 18.5, 5.5, 10);
doc.setTextColor(...C.blanc);
doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
doc.text('WiTracEQUIP', 32, 12);
doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
doc.setTextColor(...C.grisBleu);
doc.text("Rapport d'intervention  ·  " + rpTxt(date) + (ref ? '  ·  ' + rpTxt(ref) : ''), 32, 19);
doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
doc.setTextColor(...C.ambreClair);
doc.text('SUITE DU RAPPORT', 192, 15, { align: 'right' });
}

function rpTitreSectionPDF(doc, y, titre){
const C = RP_PDF_COULEURS;
doc.setFont('helvetica', 'bold'); doc.setFontSize(13.8);
doc.setTextColor(...C.nuit);
const titrePDF = rpTxt(titre);
doc.text(titrePDF, 18, y + 7.5);
const debutLigne = 18 + doc.getTextWidth(titrePDF) + 7;
if(192 - debutLigne > 8){
const finAccent = Math.min(192, debutLigne + 9);
doc.setLineWidth(0.3);
doc.setDrawColor(...C.ambre);
doc.line(debutLigne, y + 5.4, finAccent, y + 5.4);
if(192 - finAccent > 2){
doc.setDrawColor(...C.ligne);
doc.line(finAccent, y + 5.4, 192, y + 5.4);
}
}
return y + 11;
}

async function rpConstruirePDF(r){
const JsPDF = await rpChargerJsPDF();
const [logo, signature] = await Promise.all([
rpChargerLogoPDF(), rpLireSignaturePDF(r.signature_path),
]);
const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
const C = RP_PDF_COULEURS;
const L = 18, R = 192, LARGEUR = R - L;
const BAS_CORPS = 277, DEBUT_PAGE_SUIVANTE = 37;
let y;

const client = rpNomClient(r);
const code = String((r.organizations && r.organizations.code_client) || '').trim();
const date = fmtDate(r.date_intervention);
const ref = 'RI-' + (String(r.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'SANSREF');
const titrePDF = `Rapport d'intervention - ${rpTxt(client)} - ${rpTxt(date)}`;
doc.setProperties({
title: titrePDF,
subject: rpTxt("Traçabilité d’une intervention technique"),
author: 'WiTracEQUIP - WiDIAG MQ',
creator: 'WiTracEQUIP',
keywords: rpTxt('WiTracEQUIP, intervention, maintenance, traçabilité'),
});

doc.setFillColor(...C.fond);
doc.rect(0, 0, 210, 297, 'F');
rpDessinerEntetePDF(doc, logo, true, date, ref);
y = 60;
const nouvellePage = () => {
doc.addPage();
doc.setFillColor(...C.fond);
doc.rect(0, 0, 210, 297, 'F');
rpDessinerEntetePDF(doc, logo, false, date, ref);
y = DEBUT_PAGE_SUIVANTE;
return y;
};

/* Identité du client : panneau bleu nuit assorti au bandeau supérieur. */
doc.setFont('times', 'bold'); doc.setFontSize(15.2);
const largeurNom = code ? 116 : LARGEUR - 16;
const lignesClient = rpLignesPDF(doc, client, largeurNom);
doc.setFont('helvetica', 'normal'); doc.setFontSize(8.1);
const lignesCode = code ? rpLignesPDF(doc, code, 35) : [];
const hNom = 21 + (lignesClient.length - 1) * 5.8 + 7;
const hCode = lignesCode.length ? 6 + 8 + lignesCode.length * 4 + 6 : 0;
const hClient = Math.max(32, hNom, hCode);
if(y + hClient + 6 > BAS_CORPS) nouvellePage();
doc.setFillColor(...C.nuit); doc.setDrawColor(...C.nuitBord); doc.setLineWidth(0.24);
rpArrondiPDF(doc, L, y, LARGEUR, hClient, 3, 'FD');
doc.setFillColor(...C.ambre);
doc.rect(L + 0.5, y + 4, 1.5, hClient - 8, 'F');
doc.setFont('helvetica', 'bold'); doc.setFontSize(7.1);
doc.setTextColor(...C.ambreClair);
doc.text('CLIENT', L + 8, y + 9);
doc.setFont('times', 'bold'); doc.setFontSize(15.2);
doc.setTextColor(...C.blanc);
lignesClient.forEach((ligne, i) => doc.text(ligne, L + 8, y + 22 + i * 5.8));
if(code){
const xCode = R - 48, yCode = y + 6, lCode = 42, hCodeBoite = hClient - 12;
doc.setFillColor(...C.sable); doc.setDrawColor(...C.sableBord); doc.setLineWidth(0.2);
rpArrondiPDF(doc, xCode, yCode, lCode, hCodeBoite, 2, 'FD');
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.1);
doc.setTextColor(...C.muet);
doc.text('CODE CLIENT', xCode + 5, yCode + 8);
doc.setFont('helvetica', 'bold'); doc.setFontSize(8.1);
doc.setTextColor(...C.nuit);
lignesCode.slice(0, Math.max(1, Math.floor((hCodeBoite - 13) / 4))).forEach((ligne, i) => doc.text(ligne, xCode + 5, yCode + 17 + i * 4));
}
y += hClient + 6;

/* Intervenant et destinataire dans un seul bandeau, séparés par un filet. */
const largeurColonne = (LARGEUR - 8) / 2;
const champs = [
{ x: L, label: 'INTERVENANT', valeur: r.nom_support || '-' },
{ x: L + largeurColonne + 8, label: 'DESTINATAIRE', valeur: r.email_destinataire || '-' },
];
doc.setFont('helvetica', 'normal'); doc.setFontSize(9.4);
champs.forEach(champ => { champ.lignes = rpLignesPDF(doc, champ.valeur, largeurColonne - 14); });
const nbLignesChamp = Math.max(...champs.map(champ => champ.lignes.length));
const hChamps = Math.max(23, 15 + nbLignesChamp * 4.5);
if(y + hChamps + 6 > BAS_CORPS) nouvellePage();
doc.setFillColor(...C.ivoire); doc.setDrawColor(...C.ligne); doc.setLineWidth(0.22);
rpArrondiPDF(doc, L, y, LARGEUR, hChamps, 2, 'FD');
doc.setDrawColor(...C.ligne); doc.setLineWidth(0.3);
doc.line(L + largeurColonne + 4, y + 5, L + largeurColonne + 4, y + hChamps - 5);
for(const champ of champs){
doc.setFillColor(...C.ambre); doc.rect(champ.x + 6, y + 5, 7, 0.9, 'F');
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
doc.setTextColor(...C.muet);
doc.text(champ.label, champ.x + 6, y + 11);
doc.setFont('helvetica', 'normal'); doc.setFontSize(9.4);
doc.setTextColor(...C.encre);
champ.lignes.forEach((ligne, i) => doc.text(ligne, champ.x + 6, y + 19 + i * 4.5));
}
y += hChamps + 6;

/* Le texte occupe un vrai espace de lecture sur la feuille A4, même quand
   le compte rendu est bref. Les récits longs se poursuivent proprement. */
doc.setFont('helvetica', 'normal'); doc.setFontSize(11.4);
const raison = String(r.raison || '').trim() || '-';
const lignesRaison = rpLignesPDF(doc, raison, LARGEUR - 18);
const ligneH = 5.6;
const hauteurMinRecit = 40;

/* Bloc de fin (validation client) : leur hauteur est connue
   d'avance pour que le compte rendu remplisse exactement la place restante. */
const signataire = String(r.nom_signataire || '').trim() || 'Nom non renseigné';
doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2);
const lignesSignataire = rpLignesPDF(doc, signataire, 58);
const hSignature = Math.max(44, 37 + lignesSignataire.length * 4.5);
const hBlocSignature = 11 + hSignature + 5;
const hApres = hBlocSignature;
doc.setFont('helvetica', 'normal'); doc.setFontSize(11.4);
const hauteurRecitComplet = Math.max(hauteurMinRecit, 19 + lignesRaison.length * ligneH);
const hauteurBlocRecit = 11 + hauteurRecitComplet + 5;
// Un long récit commence tout de suite et se poursuit sur la page suivante (pas de grand vide en bas de page 1).
if(y + 11 + 25 > BAS_CORPS) nouvellePage();
y = rpTitreSectionPDF(doc, y, 'Intervention réalisée');
let ligneRaison = 0, suiteRaison = false;
while(ligneRaison < lignesRaison.length){
const margeHaut = suiteRaison ? 12 : 11;
const place = BAS_CORPS - y;
if(place < margeHaut + ligneH + 6){ nouvellePage(); suiteRaison = true; continue; }
let nb = Math.min(lignesRaison.length - ligneRaison, Math.floor((place - margeHaut - 6) / ligneH));
if(nb < lignesRaison.length - ligneRaison && nb > 2 && lignesRaison.length - ligneRaison - nb === 1) nb--;
let hTexte = margeHaut + nb * ligneH + 6;
const dernierBloc = nb === lignesRaison.length - ligneRaison;
if(!suiteRaison && dernierBloc) hTexte = Math.max(hauteurMinRecit, hTexte);
// Dernier bloc de texte : on l'étire jusqu'aux blocs de fin pour occuper la page.
if(dernierBloc){
const libre = BAS_CORPS - y - 5 - hApres;
if(libre > hTexte) hTexte = libre;
}
doc.setFillColor(...C.ivoire); doc.setDrawColor(...C.ligne); doc.setLineWidth(0.22);
rpArrondiPDF(doc, L, y, LARGEUR, hTexte, 2.5, 'FD');
doc.setFillColor(...C.ambre); doc.rect(L + 0.5, y + 4, 1.7, hTexte - 8, 'F');
if(suiteRaison){
doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
doc.setTextColor(...C.ambreFonce);
doc.text("SUITE DE L'INTERVENTION", L + 9, y + 6);
}else{
doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
doc.setTextColor(...C.ambreFonce);
doc.text('COMPTE RENDU', L + 9, y + 7.5);
}
const premiereLigneY = y + (suiteRaison ? 14 : 16);
// Lignes de rédaction, comme sur une fiche papier.
doc.setDrawColor(...C.ligne); doc.setLineWidth(0.15);
for(let ly = premiereLigneY + 1.6; ly <= y + hTexte - 5; ly += ligneH) doc.line(L + 9, ly, R - 9, ly);
doc.setFont('helvetica', 'normal'); doc.setFontSize(11.4);
doc.setTextColor(...C.encre);
for(let i = 0; i < nb; i++){
const texteLigne = lignesRaison[ligneRaison + i];
if(texteLigne) doc.text(texteLigne, L + 9, premiereLigneY + i * ligneH);
}
ligneRaison += nb;
y += hTexte + (ligneRaison < lignesRaison.length ? 0 : 5);
if(ligneRaison < lignesRaison.length){ nouvellePage(); suiteRaison = true; }
}

/* Validation client et signature, assorties au panneau Client. */
if(y + hBlocSignature - 5 > BAS_CORPS) nouvellePage();
y = rpTitreSectionPDF(doc, y, 'Validation client');
doc.setFillColor(...C.nuit); doc.setDrawColor(...C.nuitBord); doc.setLineWidth(0.24);
rpArrondiPDF(doc, L, y, LARGEUR, hSignature, 2.5, 'FD');
doc.setFillColor(...C.ambre);
doc.rect(L + 0.5, y + 4, 1.5, hSignature - 8, 'F');
const xCadreSignature = L + 7, yCadreSignature = y + 12, lCadreSignature = 90, hCadreSignature = 26;
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.9);
doc.setTextColor(...C.ambreClair);
doc.text('SIGNATURE DU CLIENT', L + 8, y + 8);
doc.setFillColor(...C.blanc); doc.setDrawColor(...C.ligne); doc.setLineWidth(0.2);
rpArrondiPDF(doc, xCadreSignature, yCadreSignature, lCadreSignature, hCadreSignature, 1.5, 'FD');
if(signature){
try{
const props = doc.getImageProperties(signature);
const largeurInterne = lCadreSignature - 8, hauteurInterne = hCadreSignature - 4;
const ratio = props && props.width && props.height ? Math.min(largeurInterne / props.width, hauteurInterne / props.height) : 0;
if(ratio){
const w = props.width * ratio, h = props.height * ratio;
doc.addImage(signature, 'PNG', xCadreSignature + (lCadreSignature - w) / 2, yCadreSignature + (hCadreSignature - h) / 2, w, h);
}else doc.addImage(signature, 'PNG', xCadreSignature + 4, yCadreSignature + 3, largeurInterne, hauteurInterne - 2);
}catch(_){
doc.setFont('helvetica', 'italic'); doc.setFontSize(8.2);
doc.setTextColor(...C.muet);
doc.text('Signature non disponible', xCadreSignature + 5, yCadreSignature + 15);
}
}else{
doc.setFont('helvetica', 'italic'); doc.setFontSize(8.2);
doc.setTextColor(...C.muet);
const messageSignature = r.signature_path ? 'Fichier de signature indisponible' : 'Aucune signature associée';
rpLignesPDF(doc, messageSignature, lCadreSignature - 10).slice(0, 3).forEach((ligne, i) => {
if(ligne) doc.text(ligne, xCadreSignature + 5, yCadreSignature + 12 + i * 4);
});
}
const xSeparateur = L + 105;
doc.setDrawColor(...C.grisBleuClair); doc.setLineWidth(0.28);
doc.line(xSeparateur, y + 6, xSeparateur, y + hSignature - 6);
doc.setFont('helvetica', 'bold'); doc.setFontSize(6.9);
doc.setTextColor(...C.ambreClair);
doc.text('NOM DU SIGNATAIRE', xSeparateur + 8, y + 8);
doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2);
doc.setTextColor(...C.blanc);
lignesSignataire.forEach((ligne, i) => doc.text(ligne, xSeparateur + 8, y + 18 + i * 4.5));
doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2);
doc.setTextColor(...C.grisBleu);
rpLignesPDF(doc, "Le client atteste la réalisation de l'intervention décrite dans ce rapport.", 54).slice(0, 3).forEach((ligne, i) => {
if(ligne) doc.text(ligne, xSeparateur + 8, y + hSignature - 14.5 + i * 3.6);
});
y += hSignature + 5;

/* Pied discret, imprimable même en noir et blanc. */
const nombrePages = doc.getNumberOfPages();
for(let i = 1; i <= nombrePages; i++){
doc.setPage(i);
doc.setDrawColor(...C.ligne); doc.setLineWidth(0.25);
doc.line(L, 282, R, 282);
doc.setFont('helvetica', 'normal'); doc.setFontSize(7.1);
doc.setTextColor(...C.muet);
doc.text('WiTracEQUIP  ·  by WiDIAG MQ', L, 288);
if(typeof SUPPORT_EMAIL !== 'undefined' && SUPPORT_EMAIL) doc.text(rpTxt(SUPPORT_EMAIL), 105, 288, { align: 'center' });
doc.setFont('helvetica', 'bold'); doc.setFontSize(7.1);
doc.text(`PAGE ${i} / ${nombrePages}`, R, 288, { align: 'right' });
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

const client = rpNomClient(r);
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
if(t && t.dataset && t.dataset.rp === 'champ' && rapports.form){
rapports.form[t.name] = t.value;
if(t.name === 'client_nom'){
rapports.form.client_id = rpResoudreClient(t.value);
const h = document.getElementById('rp-client-hint');
if(h) h.textContent = rapports.form.client_id ? 'Client de la liste sélectionné.' : (t.value.trim() ? 'Nom saisi à la main (client hors liste).' : 'Effacez le champ pour voir toute la liste.');
}
}
});

document.addEventListener('change', (e) => {
const t = e.target;
if(!t || !t.dataset || !rapports.form) return;
if(t.dataset.rp === 'champ'){
rapports.form[t.name] = t.value;
if(t.name === 'client_nom') rapports.form.client_id = rpResoudreClient(t.value);
}
else if(t.dataset.rp === 'fichiers') rpAjouterFichiers(t);
else if(t.dataset.rp === 'sel'){ rpSelBasculer(t.dataset.id, t.checked); render(); }
else if(t.dataset.rp === 'sel-tout'){ rpSelTout(t.checked); render(); }
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
rapports.vue = t.dataset.vue; rapports.liste = null; rapports.listeError = ''; rapports.ouvert = null; rapports.sel = [];
render();
}
}
else if(a === 'sel-vider'){ rapports.sel = []; render(); }
else if(a === 'lot-exporter') rpLotExporter();
else if(a === 'lot-archiver') rpLotArchiver(true);
else if(a === 'lot-restaurer') rpLotArchiver(false);
else if(a === 'lot-supprimer') rpLotSupprimer();
else if(a === 'actualiser'){ rapports.listeError = ''; chargerRapports(true); }
});

document.addEventListener('submit', (e) => {
if(e.target && e.target.id === 'rp-form'){
e.preventDefault();
rapports.modificationId ? rpEnregistrerModification() : rpEnregistrer();
}
});
/* ---------------------------------------------------------------------- */
