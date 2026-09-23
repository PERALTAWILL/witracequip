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
search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 12.5h18"/>',
journal: '<path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v15.5H7.5A1.5 1.5 0 0 1 6 19V3.5Z"/><path d="M6 17.5h12.5M9.5 8h5.5M9.5 11.5h5.5"/>',
wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3.5 17.4a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.3-5.4l-2.5 2.5-2.1-.5-.5-2.1 2.6-2.4Z"/>',
plus: '<path d="M12 5v14M5 12h14"/>',
archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
inbox: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5.5Z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z"/>',
pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
smartphone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/>',
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
