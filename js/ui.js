/* ---------------------------------------------------------------------- */
/* Interface : notifications, boîtes de dialogue, fluidité du rendu        */
/* ---------------------------------------------------------------------- */
/* Remplace les alert() / confirm() / prompt() du navigateur — gris, bloquants
   et différents sur chaque téléphone — par des composants aux couleurs de
   l'application. Ils vivent HORS de #app : un render() de l'application ne
   les efface donc jamais. */

/* ---------- Notifications (toasts) ---------- */

function racineToasts(){
let r = document.getElementById('toasts');
if(!r){ r = document.createElement('div'); r.id = 'toasts'; r.setAttribute('aria-live', 'polite'); document.body.appendChild(r); }
return r;
}

/** toast('Équipement archivé') · toast('Erreur : …', 'erreur') */
function toast(message, genre){
const g = genre || 'ok';
const el = document.createElement('div');
el.className = 'toast toast-' + g;
const icone = g === 'erreur' ? '!' : (g === 'info' ? 'i' : '✓');
el.innerHTML = `<span class="toast-icone">${icone}</span><span class="toast-texte">${esc(message)}</span>`;
el.addEventListener('click', () => fermerToast(el));
racineToasts().appendChild(el);
requestAnimationFrame(() => el.classList.add('visible'));
setTimeout(() => fermerToast(el), g === 'erreur' ? 6500 : 3200);
}

function fermerToast(el){
if(!el.isConnected) return;
el.classList.remove('visible');
setTimeout(() => el.remove(), 250);
}

/* ---------- Boîtes de dialogue ---------- */

let dialogueOuvert = null;

/* Le premier paragraphe du message sert de titre, le reste de texte. */
function decouperMessage(message){
const parties = String(message).split(/\n\s*\n/);
return { titre: parties.shift(), corps: parties.join('\n\n') };
}

function ouvrirDialogue({ message, ok, danger, saisie, valeur }){
return new Promise((resolve) => {
if(dialogueOuvert) dialogueOuvert.fermer(null);
const { titre, corps } = decouperMessage(message);
const fond = document.createElement('div');
fond.className = 'dlg-fond';
fond.innerHTML = `
<div class="dlg" role="alertdialog" aria-modal="true">
<div class="dlg-titre">${esc(titre)}</div>
${corps ? `<div class="dlg-corps">${esc(corps)}</div>` : ''}
${saisie ? `<input type="text" class="dlg-saisie" autocomplete="off" spellcheck="false" placeholder="${esc(saisie)}" value="${esc(valeur || '')}">` : ''}
<div class="dlg-actions">
<button class="btn" data-dlg="annuler">Annuler</button>
<button class="btn ${danger ? 'btn-danger-plein' : 'btn-primary'}" data-dlg="ok">${esc(ok || 'Confirmer')}</button>
</div>
</div>`;
document.body.appendChild(fond);
const champ = fond.querySelector('.dlg-saisie');
const fermer = (valeur) => {
document.removeEventListener('keydown', clavier, true);
fond.classList.remove('visible');
setTimeout(() => fond.remove(), 180);
dialogueOuvert = null;
resolve(valeur);
};
const valider = () => fermer(saisie ? champ.value : true);
const clavier = (e) => {
if(e.key === 'Escape'){ e.stopPropagation(); fermer(saisie ? null : false); }
else if(e.key === 'Enter' && (saisie || document.activeElement?.dataset.dlg !== 'annuler')){ e.preventDefault(); valider(); }
};
document.addEventListener('keydown', clavier, true);
fond.addEventListener('click', (e) => {
const b = e.target.closest('[data-dlg]');
if(b) return b.dataset.dlg === 'ok' ? valider() : fermer(saisie ? null : false);
if(e.target === fond) fermer(saisie ? null : false);
});
dialogueOuvert = { fermer };
requestAnimationFrame(() => {
fond.classList.add('visible');
(champ || fond.querySelector('[data-dlg="ok"]')).focus();
if(champ && champ.value) champ.select();
});
});
}

/** if(!await confirmer('Supprimer ?\n\nDétails…', { danger:true, ok:'Supprimer' })) return; */
function confirmer(message, options){
const o = options || {};
const danger = o.danger ?? /supprim|suspend|fermer|annuler cette|changer le lien|administrateur/i.test(String(message).split('\n')[0]);
// Le bouton reprend le verbe de la question : « Supprimer ? » → [Supprimer].
const titre = String(message).split('\n')[0];
const verbes = [[/^supprimer/i,'Supprimer'],[/^suspendre/i,'Suspendre'],[/^réactiver/i,'Réactiver'],[/^restaurer/i,'Restaurer'],
[/^annuler cette/i,"Annuler l'invitation"],[/^fermer/i,'Fermer'],[/^changer/i,'Changer le lien'],[/^promouvoir/i,'Promouvoir'],
[/^créer/i,'Créer'],[/^ajouter/i,'Ajouter']];
const ok = o.ok || (verbes.find(([re]) => re.test(titre)) || [null, 'Confirmer'])[1];
return ouvrirDialogue({ message, ok, danger });
}

/** Renvoie le texte saisi, ou null si annulé. */
function demander(message, options){
const o = options || {};
return ouvrirDialogue({ message, ok: o.ok || 'Valider', danger: !!o.danger, saisie: o.placeholder || '…', valeur: o.valeur });
}

/* ---------- Rendu sans à-coups ---------- */

/* Réafficher la page (innerHTML) recrée tous les champs : celui qu'on est en
   train de taper perdrait le focus et le curseur. On le retrouve après coup. */
function capturerFocus(){
const el = document.activeElement;
if(!el || el === document.body || !el.closest('#app')) return null;
if(!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return null;
const attrs = ['data-action', 'data-id', 'data-key', 'data-i', 'data-type', 'name', 'id'];
const sel = el.tagName.toLowerCase() + attrs
.filter(a => el.hasAttribute(a))
.map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('');
let debut = null, fin = null;
try{ debut = el.selectionStart; fin = el.selectionEnd; }catch(e){}
return { sel, debut, fin };
}

function restaurerFocus(etat){
if(!etat || !etat.sel || etat.sel.indexOf('[') === -1) return;
const el = document.querySelector('#app ' + etat.sel);
if(!el) return;
el.focus({ preventScroll: true });
try{ if(etat.debut !== null) el.setSelectionRange(etat.debut, etat.fin); }catch(e){}
}

/* ---------- Squelettes de chargement ---------- */

function squeletteListe(n){
return `<div class="card liste-select squelette-liste" aria-busy="true">${Array.from({ length: n || 5 }, () => `
<div class="ligne-select">
<div class="sq sq-carre"></div>
<div style="flex:1;min-width:0;"><div class="sq sq-ligne" style="width:52%;"></div><div class="sq sq-ligne sq-fine" style="width:34%;"></div></div>
</div>`).join('')}</div>`;
}

function squeletteFiche(titre, retour){
return `
<div class="fiche-entete">
<button class="icon-btn" data-action="go" data-path="${retour || '/equipements'}" title="Retour">←</button>
<div class="titre">${titre ? `<h2>${esc(titre)}</h2>` : `<div class="sq sq-titre"></div>`}<div class="sq sq-ligne sq-fine" style="width:180px;"></div></div>
</div>
<div class="grid-2" style="align-items:start;" aria-busy="true">
<div class="card"><div class="sq" style="width:200px;height:200px;margin:10px auto;border-radius:12px;"></div></div>
<div class="card">${Array.from({ length: 5 }, () => `<div class="sq sq-ligne" style="margin:14px 0;"></div>`).join('')}</div>
</div>`;
}
