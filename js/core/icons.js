/* ---------------------------------------------------------------------- */
/* Helpers */
/* ---------------------------------------------------------------------- */

function esc(s){
return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initials(name){
if(!name) return '?';
return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
/* Icônes de la navigation (sidebar desktop / barre du bas mobile) : traits
SVG dessinés à la main, pas de police d'icônes ni de dépendance externe. */
const ICONES_NAV = {
home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/>',
box: '<path d="M12 3 3 7.5 12 12l9-4.5Z"/><path d="M3 7.5v9L12 21l9-4.5v-9"/><path d="M12 12v9"/>',
tag: '<path d="M4 6h16M7 12h10M10 18h4"/>',
users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c1.2-3.6 3.8-5.3 6.5-5.3s5.3 1.7 6.5 5.3"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.3 15c2.1.4 3.7 1.9 4.6 4.6"/>',
clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17.2h.01"/>',
trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
scan: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><path d="M14 15h3v3M20 15v3h-3M14 21h3"/>',
};
function iconeNav(nom, taille){
const t = taille || 18;
return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="${t}" height="${t}">${ICONES_NAV[nom] || ''}</svg>`;
}
function fmtDate(d){
if(!d) return '—';
// Une date seule (AAAA-MM-JJ) est interprétée par JavaScript comme minuit UTC.
// Aux Antilles (UTC-4), elle s'afficherait donc la veille. On la construit
// explicitement en heure locale pour que la date saisie soit la date affichée.
const m = (typeof d === 'string') && d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
try{
const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
return dt.toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
}catch(e){ return d; }
}
function fmtDateTime(d){
if(!d) return '—';
try{ return new Date(d).toLocaleString('fr-FR', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}); }
catch(e){ return d; }
}
function uuid(){
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8);
return v.toString(16);
});
}

/* ---------------------------------------------------------------------- */
