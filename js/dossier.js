/* ======================================================================
   WiTracEQUIP — Dossier de contrôle (PDF « prêt pour le contrôle »)
   ----------------------------------------------------------------------
   Depuis « Statistiques & export », un bouton ouvre une fenêtre : périmètre
   (tout le parc ou une catégorie), période, destinataire. Le PDF est fabriqué
   sur l'appareil (jsPDF, chargé à la demande) à partir des données déjà
   affichées : rien n'est envoyé à un tiers, rien n'est modifié en base.
   Module additif : s'il échoue, le reste de l'application n'est pas touché.
   ====================================================================== */
(function(){
'use strict';

var OPT = { perimetre:'all', periode:12, dest:'interne', archives:true, trace:true };
var ETAT = { ouvert:false, enCours:false, d:null };
var DEST = {
  interne:{ lib:'Usage interne', txt:"Dossier établi pour le suivi interne de l'établissement." },
  ars:{ lib:'ARS', txt:"À l'attention de l'Agence régionale de santé." },
  assureur:{ lib:'Assureur', txt:"À l'attention de l'assureur de l'établissement." },
  bureau:{ lib:'Bureau de contrôle', txt:"À l'attention du bureau de contrôle ou de l'organisme agréé." }
};
var VERT = [46,125,82], ROUGE = [192,57,43], VERT_CL = [226,242,233], ROUGE_CL = [250,228,225], AMBRE_CL = [255,240,215], GRIS = [201,209,216];
var MOIS3 = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
var DEMO_OFFSETS = [-34,120,45,200,-12,300,20,90,150,-6,60,240,75,180,30,-20,110,50,365,15,95,-3,130];

/* ---------------- Dates ---------------- */
function iso(dt){ return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function auj(){ return iso(new Date()); }
function parse(s){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0) : null; }
function ecart(s){ var a = parse(s), b = parse(auj()); return a ? Math.round((a - b) / 86400000) : null; }
function p2(n){ return String(n).padStart(2, '0'); }
function fd(s){ var p = parse(s); return p ? p2(p.getDate()) + '/' + p2(p.getMonth() + 1) + '/' + p.getFullYear() : '-'; }
function fdt(s){ try{ var x = new Date(s); if(isNaN(x.getTime())) return '-'; return fd(iso(x)) + ' ' + p2(x.getHours()) + ':' + p2(x.getMinutes()); }catch(e){ return '-'; } }
function debutPeriode(n){ if(!n) return ''; var x = new Date(); x.setMonth(x.getMonth() - n); return iso(x); }
function libPeriode(n){ return n ? 'Les ' + n + ' derniers mois' : 'Depuis la création du registre'; }

/* ---------------- Données de démonstration : échéances ---------------- */
function preparerDemo(d){
  if(!d || !d.demo || d.__dc) return d;
  var c = { demo:true, __dc:true, client:d.client, orgId:d.orgId };
  c.types = (d.types || []).map(function(t){
    var champs = (t.champs || []).slice();
    champs.push({ key:'prochain', label:'Prochain contrôle', type:'date' });
    return { id:t.id, nom:t.nom, champs:champs };
  });
  c.equipements = (d.equipements || []).map(function(e, i){
    var v = {}; for(var k in (e.valeurs || {})) v[k] = e.valeurs[k];
    if(!e.archived){
      var dt = new Date(); dt.setDate(dt.getDate() + DEMO_OFFSETS[i % DEMO_OFFSETS.length]);
      v.prochain = iso(dt);
    }
    var n = {}; for(var k2 in e) n[k2] = e[k2]; n.valeurs = v;
    if(e.archived && !e.archived_at) n.archived_at = iso(new Date(Date.now() - 200 * 86400000)) + 'T09:30:00';
    return n;
  });
  var noms = ['Karine', 'Julien', 'Steeve'], cptModif = 0;
  c.interventions = (d.interventions || []).map(function(iv, i){
    if(i % 6 !== 0) return iv;
    var n = {}; for(var k in iv) n[k] = iv[k];
    var dt = parse(iv.date); if(dt){ dt.setDate(dt.getDate() + 1); dt.setHours(8 + (i % 9), (i * 7) % 60); n.modifie_le = dt.toISOString(); n.modifie_par = noms[cptModif++ % 3]; }
    return n;
  });
  return c;
}

/* ---------------- Modèle ---------------- */
function modele(d, o){
  var typeMap = {}; (d.types || []).forEach(function(t){ typeMap[t.id] = t; });
  var debut = debutPeriode(o.periode);
  var ivParEq = {};
  (d.interventions || []).forEach(function(iv){ (ivParEq[iv.equipement_id] = ivParEq[iv.equipement_id] || []).push(iv); });
  var eqs = [];
  (d.equipements || []).forEach(function(e){
    if(o.perimetre !== 'all' && e.type_id !== o.perimetre) return;
    if(e.archived && !o.archives) return;
    var t = typeMap[e.type_id] || { nom:'Sans type', champs:[] }, v = e.valeurs || {};
    var x = { e:e, type:t.nom || 'Sans type', prochains:[], derniers:[], mise:'', empl:'', autres:[] };
    (t.champs || []).forEach(function(ch){
      var val = v[ch.key]; if(val === undefined || val === null || val === '') return;
      var lab = String(ch.label || '');
      if(ch.type === 'date' && parse(val)){
        var dd = String(val).slice(0, 10);
        if(/prochain|[ée]ch[ée]ance|p[ée]remption|requalification/i.test(lab)) x.prochains.push({ lab:lab, date:dd });
        else if(/mise en service/i.test(lab)) x.mise = dd;
        else if(/dernier|derni[eè]re|contr[oô]le|v[ée]rif|entretien|essai|vgp/i.test(lab)) x.derniers.push({ lab:lab, date:dd });
        else x.autres.push(lab + ' : ' + fd(dd));
      }else if(/emplacement|localisation|service|site|chantier|attribu|lieu/i.test(lab)){
        x.empl = x.empl ? x.empl + ' / ' + val : String(val);
      }else x.autres.push(lab + ' : ' + val);
    });
    var ivs = (ivParEq[e.id] || []).slice().sort(function(a, b){ return String(b.date).localeCompare(String(a.date)); });
    x.ivs = ivs.filter(function(iv){ return !debut || String(iv.date || '') >= debut; });
    x.toutes = ivs.length;
    var dc = ''; x.derniers.forEach(function(p){ if(p.date > dc) dc = p.date; });
    if(ivs.length && String(ivs[0].date) > dc) dc = String(ivs[0].date).slice(0, 10);
    x.dernier = dc;
    var min = null; x.prochains.forEach(function(p){ if(!min || p.date < min.date) min = p; });
    x.next = min;
    if(e.archived) x.statut = 'archive';
    else if(!min) x.statut = 'na';
    else { x.jours = ecart(min.date); x.statut = x.jours < 0 ? 'retard' : (x.jours <= 60 ? 'proche' : 'ok'); }
    var cnt = {}; x.ivs.forEach(function(iv){ if(iv.technicien) cnt[iv.technicien] = (cnt[iv.technicien] || 0) + 1; });
    x.techs = Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; }).slice(0, 3);
    eqs.push(x);
  });
  eqs.sort(function(a, b){
    if(!!a.e.archived !== !!b.e.archived) return a.e.archived ? 1 : -1;
    return a.type.localeCompare(b.type, 'fr') || String(a.e.nom).localeCompare(String(b.e.nom), 'fr');
  });
  var actifs = eqs.filter(function(x){ return !x.e.archived; });
  var types = [], tmap = {};
  actifs.forEach(function(x){
    var s = tmap[x.type];
    if(!s){ s = tmap[x.type] = { nom:x.type, n:0, ok:0, proche:0, retard:0, na:0, next:'', iv:0 }; types.push(s); }
    s.n++; s[x.statut]++; s.iv += x.ivs.length;
    if(x.next && (!s.next || x.next.date < s.next)) s.next = x.next.date;
  });
  var tot = { n:actifs.length, ok:0, proche:0, retard:0, na:0, iv:0 };
  actifs.forEach(function(x){ tot[x.statut]++; tot.iv += x.ivs.length; });
  var suivis = tot.ok + tot.proche + tot.retard;
  tot.score = suivis ? Math.round((tot.ok + tot.proche) * 100 / suivis) : null;
  var ivPeriode = 0; eqs.forEach(function(x){ ivPeriode += x.ivs.length; });
  tot.ivTous = ivPeriode;
  var brut = eqs.map(function(x){ return x.e.id + ':' + x.ivs.length + ':' + (x.next ? x.next.date : ''); }).join('|') + '@' + auj() + '@' + o.periode + o.perimetre;
  var h = 2166136261; for(var i = 0; i < brut.length; i++){ h ^= brut.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  var ref = 'DC-' + auj().replace(/-/g, '') + '-' + ('00000000' + h.toString(16)).slice(-8).toUpperCase();
  return { eqs:eqs, actifs:actifs, types:types, tot:tot, ref:ref, debut:debut };
}

/* ---------------- Fenêtre ---------------- */
function injecterStyle(){
  if(document.getElementById('dc-style')) return;
  var s = document.createElement('style'); s.id = 'dc-style';
  s.textContent =
'.dc-fond{position:fixed;inset:0;background:rgba(15,25,35,.62);z-index:9500;display:flex;align-items:center;justify-content:center;padding:14px;}' +
'.dc-carte{background:#fff;color:#1f2d38;border-radius:18px;max-width:560px;width:100%;max-height:94vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.35);}' +
'.dc-tete{background:linear-gradient(135deg,#182b3b,#30495d);color:#fff;padding:20px 22px 18px;border-radius:18px 18px 0 0;position:relative;}' +
'.dc-tete:after{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:#ef9b31;border-radius:18px 18px 0 0;}' +
'.dc-tete h3{margin:0 0 4px;font-size:21px;color:#fff;}' +
'.dc-tete p{margin:0;font-size:13px;color:#c9d1d8;line-height:1.45;}' +
'.dc-corps{padding:18px 22px 6px;}' +
'.dc-corps label.t{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6d7880;font-weight:700;margin:14px 0 7px;}' +
'.dc-corps select{width:100%;padding:11px 12px;border:1px solid #c9d1d8;border-radius:10px;font-size:15px;background:#fff;color:#1f2d38;}' +
'.dc-puces{display:flex;flex-wrap:wrap;gap:7px;}' +
'.dc-puce{border:1.5px solid #c9d1d8;background:#fff;color:#34495a;border-radius:999px;padding:8px 14px;font-size:14px;cursor:pointer;font-weight:600;}' +
'.dc-puce.on{background:#182b3b;border-color:#182b3b;color:#fff;}' +
'.dc-corps label.dc-coche{text-transform:none;letter-spacing:0;font-weight:500;font-size:14px;color:#1f2d38;}.dc-coche{display:flex;gap:9px;align-items:flex-start;font-size:14px;margin:9px 0;cursor:pointer;}' +
'.dc-coche input{margin-top:3px;width:17px;height:17px;}' +
'.dc-apercu{margin:16px 0 4px;background:#fff0d7;border:1px solid #e7cfaa;border-radius:12px;padding:12px 14px;}' +
'.dc-apercu b{color:#182b3b;}' +
'.dc-grille{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;}' +
'.dc-grille div{background:#fff;border-radius:9px;padding:8px 2px;}' +
'.dc-grille .v{font-size:22px;font-weight:800;color:#182b3b;line-height:1.1;}' +
'.dc-grille .l{font-size:11px;color:#6d7880;margin-top:2px;}' +
'.dc-grille .r .v{color:#c0392b;}.dc-grille .g .v{color:#2e7d52;}' +
'.dc-pied{padding:14px 22px 20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}' +
'.dc-btn{border:0;border-radius:11px;padding:12px 18px;font-size:15px;font-weight:700;cursor:pointer;}' +
'.dc-btn.s{background:#eef1f3;color:#34495a;}' +
'.dc-btn.p{background:#ef9b31;color:#182b3b;}' +
'.dc-btn[disabled]{opacity:.6;cursor:wait;}' +
'.dc-note{font-size:12px;color:#6d7880;margin:8px 0 0;line-height:1.45;}';
  document.head.appendChild(s);
}

function esc2(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function rendreModale(){
  var el = document.getElementById('dc-fond'); if(!el) return;
  var d = ETAT.d, m = modele(d, OPT);
  var actifsTous = (d.equipements || []).filter(function(e){ return !e.archived; });
  var parType = {}; actifsTous.forEach(function(e){ parType[e.type_id] = (parType[e.type_id] || 0) + 1; });
  var optionsType = (d.types || []).filter(function(t){ return parType[t.id]; }).map(function(t){
    return '<option value="' + esc2(t.id) + '"' + (OPT.perimetre === t.id ? ' selected' : '') + '>' + esc2(t.nom) + ' (' + parType[t.id] + ')</option>';
  }).join('');
  function puces(cle, liste){
    return '<div class="dc-puces">' + liste.map(function(p){
      return '<button type="button" class="dc-puce' + (String(OPT[cle]) === String(p[0]) ? ' on' : '') + '" data-dc="' + cle + '" data-v="' + p[0] + '">' + p[1] + '</button>';
    }).join('') + '</div>';
  }
  var t = m.tot;
  el.innerHTML =
'<div class="dc-carte" role="dialog" aria-modal="true" aria-label="Dossier de contrôle">' +
'<div class="dc-tete"><h3>Dossier de contrôle</h3><p>Un dossier PDF complet, prêt à remettre en cas de contrôle : registre des équipements, échéances, historique des interventions et traçabilité.</p></div>' +
'<div class="dc-corps">' +
'<label class="t">Périmètre</label>' +
'<select data-dc-select="perimetre"><option value="all">Tout le parc (' + actifsTous.length + ' équipement' + (actifsTous.length > 1 ? 's' : '') + ')</option>' + optionsType + '</select>' +
'<label class="t">Période d\'historique</label>' + puces('periode', [[6, '6 mois'], [12, '12 mois'], [24, '24 mois'], [0, 'Tout l\'historique']]) +
'<label class="t">Destinataire</label>' + puces('dest', [['interne', 'Usage interne'], ['ars', 'ARS'], ['assureur', 'Assureur'], ['bureau', 'Bureau de contrôle']]) +
'<label class="t">Contenu</label>' +
'<label class="dc-coche"><input type="checkbox" data-dc-check="archives"' + (OPT.archives ? ' checked' : '') + '><span>Inclure les équipements archivés (réformés, vendus, remplacés)</span></label>' +
'<label class="dc-coche"><input type="checkbox" data-dc-check="trace"' + (OPT.trace ? ' checked' : '') + '><span>Inclure l\'annexe de traçabilité (qui a saisi ou modifié quoi, et quand)</span></label>' +
'<div class="dc-apercu"><div style="font-size:12px;margin-bottom:8px;">Aperçu du dossier</div><div class="dc-grille">' +
'<div><div class="v">' + t.n + '</div><div class="l">équipements</div></div>' +
'<div><div class="v">' + t.ivTous + '</div><div class="l">interventions</div></div>' +
'<div class="' + (t.retard ? 'r' : 'g') + '"><div class="v">' + t.retard + '</div><div class="l">en retard</div></div>' +
'<div class="' + (t.score !== null && t.score >= 80 ? 'g' : '') + '"><div class="v">' + (t.score === null ? '-' : t.score + '%') + '</div><div class="l">conformité</div></div>' +
'</div></div>' +
'<p class="dc-note">Les échéances viennent des champs « Prochain contrôle », « Prochaine VGP »… de chaque fiche. Un équipement sans échéance renseignée est indiqué comme tel, sans être compté en retard. Le PDF est fabriqué sur cet appareil : rien n\'est envoyé ailleurs.</p>' +
'</div>' +
'<div class="dc-pied"><button type="button" class="dc-btn s" data-dc-act="fermer">Annuler</button><button type="button" class="dc-btn p" data-dc-act="generer"' + (ETAT.enCours ? ' disabled' : '') + '>' + (ETAT.enCours ? 'Génération en cours…' : 'Générer le dossier PDF') + '</button></div>' +
'</div>';
}

function ouvrir(){
  try{
    var brut = (typeof statsState !== 'undefined') ? statsState.data : null;
    if(!brut){ toast('Chargez d\'abord les statistiques.', 'erreur'); return; }
    ETAT.d = preparerDemo(brut); ETAT.ouvert = true; injecterStyle();
    var el = document.getElementById('dc-fond');
    if(!el){ el = document.createElement('div'); el.id = 'dc-fond'; el.className = 'dc-fond'; document.body.appendChild(el); }
    rendreModale();
  }catch(e){ try{ toast('Dossier de contrôle indisponible : ' + (e.message || e), 'erreur'); }catch(_){} }
}
function fermer(){ ETAT.ouvert = false; var el = document.getElementById('dc-fond'); if(el) el.remove(); }

document.addEventListener('click', function(e){
  var t = e.target;
  if(!t || !t.closest) return;
  if(t.closest('[data-action="dossier-ouvrir"]')){ ouvrir(); return; }
  var fond = document.getElementById('dc-fond'); if(!fond) return;
  if(t === fond){ if(!ETAT.enCours) fermer(); return; }
  var p = t.closest('[data-dc]');
  if(p){ var k = p.getAttribute('data-dc'), v = p.getAttribute('data-v'); OPT[k] = (k === 'periode') ? +v : v; rendreModale(); return; }
  var a = t.closest('[data-dc-act]');
  if(a){ var act = a.getAttribute('data-dc-act'); if(act === 'fermer' && !ETAT.enCours) fermer(); else if(act === 'generer') generer(); }
});
document.addEventListener('change', function(e){
  var t = e.target; if(!t || !t.getAttribute || !document.getElementById('dc-fond')) return;
  var s = t.getAttribute('data-dc-select'), c = t.getAttribute('data-dc-check');
  if(s){ OPT[s] = t.value; rendreModale(); }
  else if(c){ OPT[c] = !!t.checked; rendreModale(); }
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && ETAT.ouvert && !ETAT.enCours) fermer(); });

/* ---------------- QR codes ---------------- */
function qr(url){
  try{
    if(typeof QRious === 'undefined') return null;
    var c = document.createElement('canvas');
    new QRious({ element:c, value:url, size:240, level:'M', background:'white', foreground:'#141b1e' });
    return c.toDataURL('image/png');
  }catch(e){ return null; }
}
async function jetons(d){
  var r = {};
  if(d.demo){ (d.equipements || []).forEach(function(e, i){ r[e.id] = 'demo' + (i + 1); }); return r; }
  try{
    var q = await sb.from('equipements').select('id, public_token').eq('organization_id', d.orgId);
    if(!q.error) (q.data || []).forEach(function(x){ if(x.public_token) r[x.id] = x.public_token; });
  }catch(e){}
  return r;
}

/* ---------------- PDF ---------------- */
async function fabriquerPdf(d, o){
  var JsPDF = await rpChargerJsPDF();
  var logo = null; try{ logo = await rpChargerLogoPDF(); }catch(e){}
  var tokens = await jetons(d);
  var m = modele(d, o);
  var C = RP_PDF_COULEURS, T = rpTxt;
  var base = (typeof APP_BASE_URL === 'string' && APP_BASE_URL) ? APP_BASE_URL : 'https://witracequip.fr/';
  var auteur = (typeof state !== 'undefined' && state.profile && state.profile.full_name) || '';
  var dest = DEST[o.dest] || DEST.interne;
  var client = d.client || 'Établissement';
  var doc = new JsPDF({ unit:'mm', format:'a4', compress:true });
  try{ doc.setProperties({ title:'Dossier de contrôle - ' + T(client), author:'WiTracEQUIP', subject:m.ref, creator:'WiTracEQUIP' }); }catch(e){}
  var L = 20, W = 170, BAS = 278, y = 0;

  function txt(s, x, yy, opt){ doc.text(T(s), x, yy, opt); }
  function coupe(s, w){ var l = doc.splitTextToSize(T(s), w); var r = Array.isArray(l) ? l[0] : l; if(Array.isArray(l) && l.length > 1) r = r.replace(/\s*\S{0,2}$/, '') + '...'; return r || ''; }
  function fill(c){ doc.setFillColor(c[0], c[1], c[2]); }
  function ink(c){ doc.setTextColor(c[0], c[1], c[2]); }
  function draw(c){ doc.setDrawColor(c[0], c[1], c[2]); }
  function font(st, sz){ doc.setFont('helvetica', st); doc.setFontSize(sz); }
  function couleurStatut(s){ return s === 'retard' ? ROUGE : s === 'proche' ? C.ambre : s === 'ok' ? VERT : GRIS; }

  function pageContenu(){
    doc.addPage(); fill(C.fond); doc.rect(0, 0, 210, 297, 'F');
    fill(C.nuit); doc.rect(0, 0, 210, 13, 'F'); fill(C.ambre); doc.rect(0, 13, 210, 0.8, 'F');
    font('bold', 8.5); ink(C.blanc); txt('WiTracEQUIP', L, 8.4);
    font('normal', 7.5); ink(C.grisBleu); txt('Dossier de contrôle  -  ' + coupe(client, 100), 190, 8.4, { align:'right' });
    y = 26;
  }
  function besoin(h){ if(y + h > BAS) pageContenu(); }
  function titre(num, t, sous){
    besoin(26);
    fill(C.ambre); doc.circle(L + 4, y + 3, 4, 'F');
    font('bold', 10); ink(C.nuit); txt(String(num), L + 4, y + 4.6, { align:'center' });
    font('bold', 16); ink(C.nuit); txt(t, L + 12, y + 5);
    if(sous){ font('normal', 8.5); ink(C.muet); txt(sous, L + 12, y + 10.5); }
    draw(C.ambre); doc.setLineWidth(0.5); doc.line(L, y + 14, L + W, y + 14);
    y += 20;
  }
  function pastille(x, yy, w, statut, texte){
    var col = couleurStatut(statut), clair = statut === 'retard' ? ROUGE_CL : statut === 'ok' ? VERT_CL : statut === 'proche' ? AMBRE_CL : [236, 239, 241];
    fill(clair); rpArrondiPDF(doc, x, yy, w, 5.4, 2.7, 'F');
    font('bold', 6.8); doc.setTextColor(col[0] * 0.75, col[1] * 0.75, col[2] * 0.75);
    if(statut === 'na' || statut === 'archive') ink(C.grisBleuClair);
    txt(texte, x + w / 2, yy + 3.8, { align:'center' });
  }
  function libStatut(x){
    if(x.statut === 'retard') return 'EN RETARD - ' + Math.abs(x.jours) + ' j';
    if(x.statut === 'proche') return 'ÉCHÉANCE DANS ' + x.jours + ' j';
    if(x.statut === 'ok') return 'À JOUR';
    if(x.statut === 'archive') return 'ARCHIVÉ';
    return 'ÉCHÉANCE NON RENSEIGNÉE';
  }

  /* ===== 1. Couverture ===== */
  fill(C.fond); doc.rect(0, 0, 210, 297, 'F');
  fill(C.nuit); doc.rect(0, 0, 210, 152, 'F'); fill(C.ambre); doc.rect(0, 0, 210, 2.2, 'F');
  fill(C.blanc); rpArrondiPDF(doc, L, 16, 13, 13, 2.6, 'F'); rpMarquePDF(doc, logo, L + 0.8, 16.8, 11.4);
  font('bold', 13); ink(C.blanc); txt('WiTracEQUIP', L + 18, 24);
  font('normal', 8); ink(C.grisBleu); txt('by WiDIAG MQ  -  Passeport numérique de vos équipements', L + 18, 29.4);
  try{ doc.setCharSpace(0.9); }catch(e){}
  font('bold', 9); ink(C.ambreClair); txt('DOSSIER DE CONTRÔLE', L, 62);
  try{ doc.setCharSpace(0); }catch(e){}
  font('bold', 27); ink(C.blanc);
  var nomLignes = doc.splitTextToSize(T(client), W); if(nomLignes.length > 3) nomLignes = nomLignes.slice(0, 3);
  doc.text(nomLignes, L, 76, { lineHeightFactor:1.18 });
  var yy = 76 + nomLignes.length * 10.6 + 2;
  font('normal', 11.5); ink(C.grisBleu); txt('Registre de maintenance et de conformité des équipements', L, yy + 2);
  fill(C.ambre); doc.rect(L, yy + 8, 26, 1.1, 'F');
  font('normal', 9.5); ink(C.blanc);
  txt('Période d\'historique : ' + libPeriode(o.periode) + (m.debut ? ' (depuis le ' + fd(m.debut) + ')' : ''), L, yy + 18);
  txt('Périmètre : ' + (o.perimetre === 'all' ? 'ensemble du parc' : ((m.eqs[0] && m.eqs[0].type) || 'catégorie') + ' uniquement'), L, yy + 24);
  txt(dest.txt, L, yy + 30);
  if(d.demo){ fill(C.ambre); rpArrondiPDF(doc, L, 136, 88, 7.5, 3.7, 'F'); font('bold', 7.6); ink(C.nuit); txt('DOSSIER DE DÉMONSTRATION - DONNÉES SIMULÉES', L + 44, 141, { align:'center' }); }
  /* Chiffres clés */
  var cartes = [
    [String(m.tot.n), 'équipements suivis', C.nuit],
    [String(m.tot.ivTous), 'interventions sur la période', C.nuit],
    [String(m.tot.retard), m.tot.retard > 1 ? 'équipements en retard' : 'équipement en retard', m.tot.retard ? ROUGE : VERT]
  ];
  cartes.forEach(function(k, i){
    var x = L + i * 58;
    fill(C.blanc); draw(C.ligne); doc.setLineWidth(0.3); rpArrondiPDF(doc, x, 166, 54, 40, 3, 'FD');
    fill(k[2]); doc.rect(x, 172, 1.4, 28, 'F');
    font('bold', 30); ink(k[2]); txt(k[0], x + 8, 189);
    font('normal', 8.6); ink(C.bleuTexte); txt(k[1], x + 8, 198);
  });
  /* Jauge de conformité */
  fill(C.blanc); draw(C.ligne); rpArrondiPDF(doc, L, 214, W, 34, 3, 'FD');
  font('bold', 9.5); ink(C.nuit); txt('Conformité des échéances de contrôle', L + 7, 223);
  font('bold', 22); ink(m.tot.score === null ? C.muet : (m.tot.score >= 90 ? VERT : (m.tot.score >= 70 ? C.ambreFonce : ROUGE)));
  txt(m.tot.score === null ? '-' : m.tot.score + ' %', L + W - 7, 226, { align:'right' });
  var bx = L + 7, bw = W - 14, cur = bx, ord = [['ok', VERT], ['proche', C.ambre], ['retard', ROUGE], ['na', GRIS]];
  fill([236, 239, 241]); rpArrondiPDF(doc, bx, 230, bw, 5.5, 2.7, 'F');
  if(m.tot.n){
    ord.forEach(function(p){
      var w = bw * m.tot[p[0]] / m.tot.n; if(w <= 0) return;
      fill(p[1]); doc.rect(cur, 230, w, 5.5, 'F'); cur += w;
    });
  }
  var leg = [['À jour', m.tot.ok, VERT], ['Échéance < 60 j', m.tot.proche, C.ambre], ['En retard', m.tot.retard, ROUGE], ['Non renseignée', m.tot.na, GRIS]];
  leg.forEach(function(l, i){
    var x = bx + i * 40; fill(l[2]); doc.circle(x + 1.5, 241.2, 1.4, 'F');
    font('normal', 7.6); ink(C.bleuTexte); txt(l[0] + ' : ' + l[1], x + 5, 242);
  });
  font('normal', 8.2); ink(C.muet);
  txt('Établi le ' + fd(auj()) + (auteur ? ' par ' + auteur : '') + '  -  Référence ' + m.ref, L, 260);
  var l1 = doc.splitTextToSize(T('Document généré automatiquement par WiTracEQUIP à partir du registre numérique de l\'établissement. Chaque intervention est horodatée et rattachée à un équipement identifié.'), W);
  doc.text(l1, L, 266);

  /* ===== 2. Synthèse ===== */
  pageContenu();
  titre(1, 'Synthèse de conformité', 'Situation des équipements en service au ' + fd(auj()));
  font('bold', 7); ink(C.muet);
  txt('CATÉGORIE', L, y); txt('ÉQUIP.', L + 66, y, { align:'right' }); txt('RÉPARTITION', L + 72, y); txt('EN RETARD', L + 134, y, { align:'right' }); txt('PROCHAINE ÉCHÉANCE', L + W, y, { align:'right' });
  y += 3; draw(C.ligne); doc.setLineWidth(0.3); doc.line(L, y, L + W, y); y += 2;
  m.types.forEach(function(s){
    besoin(11);
    font('bold', 9); ink(C.nuit); txt(coupe(s.nom, 60), L, y + 6);
    font('normal', 9); ink(C.bleuTexte); txt(String(s.n), L + 66, y + 6, { align:'right' });
    var cx = L + 72, cw = 50, cc = cx;
    fill([236, 239, 241]); rpArrondiPDF(doc, cx, y + 3, cw, 4, 2, 'F');
    [['ok', VERT], ['proche', C.ambre], ['retard', ROUGE], ['na', GRIS]].forEach(function(p){ var w = cw * s[p[0]] / s.n; if(w > 0){ fill(p[1]); doc.rect(cc, y + 3, w, 4, 'F'); cc += w; } });
    font('bold', 9); ink(s.retard ? ROUGE : VERT); txt(s.retard ? String(s.retard) : '0', L + 134, y + 6, { align:'right' });
    font('normal', 9); ink(C.bleuTexte); txt(s.next ? fd(s.next) : '-', L + W, y + 6, { align:'right' });
    y += 10; draw(C.ligne); doc.line(L, y, L + W, y);
  });
  y += 8;
  var retards = m.actifs.filter(function(x){ return x.statut === 'retard'; }).sort(function(a, b){ return a.jours - b.jours; });
  var proches = m.actifs.filter(function(x){ return x.statut === 'proche'; }).sort(function(a, b){ return a.jours - b.jours; });
  var nas = m.actifs.filter(function(x){ return x.statut === 'na'; });
  besoin(20);
  font('bold', 11); ink(C.nuit); txt('Points d\'attention', L, y); y += 6;
  if(!retards.length){
    fill(VERT_CL); rpArrondiPDF(doc, L, y, W, 10, 2.5, 'F'); font('bold', 9); ink(VERT); txt('Aucune échéance dépassée à la date du dossier.', L + 5, y + 6.4); y += 15;
  }else{
    retards.slice(0, 14).forEach(function(x){
      besoin(9);
      fill(ROUGE_CL); rpArrondiPDF(doc, L, y, W, 7.6, 2, 'F');
      font('bold', 8.6); ink(C.nuit); txt(coupe(x.e.nom, 78), L + 4, y + 5.1);
      font('normal', 8); ink(C.bleuTexte); txt(coupe(x.next.lab, 44) + ' : ' + fd(x.next.date), L + 86, y + 5.1);
      font('bold', 8); ink(ROUGE); txt(Math.abs(x.jours) + ' j de retard', L + W - 4, y + 5.1, { align:'right' });
      y += 9;
    });
    if(retards.length > 14){ font('normal', 8); ink(C.muet); txt('... et ' + (retards.length - 14) + ' autre(s) équipement(s) en retard, détaillés dans le registre.', L, y + 3); y += 7; }
    y += 3;
  }
  if(proches.length){
    besoin(16);
    font('bold', 9.5); ink(C.ambreFonce); txt('À planifier dans les 60 jours', L, y + 2); y += 6;
    proches.slice(0, 10).forEach(function(x){
      besoin(8);
      fill(AMBRE_CL); rpArrondiPDF(doc, L, y, W, 6.8, 2, 'F');
      font('normal', 8.4); ink(C.nuit); txt(coupe(x.e.nom, 80), L + 4, y + 4.7);
      ink(C.bleuTexte); txt(coupe(x.next.lab, 40) + ' : ' + fd(x.next.date), L + 88, y + 4.7);
      font('bold', 8); ink(C.ambreFonce); txt('dans ' + x.jours + ' j', L + W - 4, y + 4.7, { align:'right' });
      y += 8.2;
    });
    y += 3;
  }
  if(nas.length){
    besoin(12);
    font('normal', 8.2); ink(C.muet);
    var ln = doc.splitTextToSize(T(nas.length + ' équipement(s) n\'ont pas d\'échéance de contrôle renseignée dans leur fiche : ils ne sont pas comptés dans le taux de conformité. Renseigner « Prochain contrôle » les intègre au suivi.'), W);
    doc.text(ln, L, y + 2); y += ln.length * 3.8 + 5;
  }
  /* Activité */
  var nb = o.periode ? Math.min(o.periode, 24) : 12, mois = [], now = new Date();
  for(var k = nb - 1; k >= 0; k--){ var mm = new Date(now.getFullYear(), now.getMonth() - k, 1); mois.push({ cle:mm.getFullYear() + '-' + p2(mm.getMonth() + 1), lib:MOIS3[mm.getMonth()], an:String(mm.getFullYear()).slice(2), n:0 }); }
  m.eqs.forEach(function(x){ x.ivs.forEach(function(iv){ var c2 = String(iv.date || '').slice(0, 7); mois.forEach(function(q){ if(q.cle === c2) q.n++; }); }); });
  besoin(60);
  font('bold', 11); ink(C.nuit); txt('Activité de maintenance', L, y); y += 3;
  font('normal', 8); ink(C.muet); txt('Interventions enregistrées par mois', L, y + 4); y += 8;
  var mx = 1; mois.forEach(function(q){ if(q.n > mx) mx = q.n; });
  var ch = 30, bw2 = W / mois.length;
  fill(C.blanc); draw(C.ligne); rpArrondiPDF(doc, L, y, W, ch + 14, 2.5, 'FD');
  mois.forEach(function(q, i){
    var h = q.n ? Math.max(1.5, (ch - 6) * q.n / mx) : 0, x = L + i * bw2 + bw2 * 0.2, w = bw2 * 0.6;
    if(h){ fill(i === mois.length - 1 ? C.ambre : C.nuit); rpArrondiPDF(doc, x, y + 4 + (ch - 6) - h + 4, w, h, 0.8, 'F'); font('bold', 6.5); ink(C.bleuTexte); txt(String(q.n), x + w / 2, y + 4 + (ch - 6) - h + 2.6, { align:'center' }); }
    font('normal', 5.8); ink(C.muet); txt(q.lib, x + w / 2, y + ch + 6, { align:'center' }); if(mois.length <= 12) txt(q.an, x + w / 2, y + ch + 9.4, { align:'center' });
  });
  y += ch + 20;

  /* ===== 3. Registre ===== */
  y += 4;
  titre(2, 'Registre des équipements', 'Fiche de chaque équipement, échéances et historique de la période');
  var groupe = null, actifsListe = m.eqs.filter(function(x){ return !x.e.archived; });
  function enteteTab(){
    fill([232, 236, 239]); doc.rect(L + 3, y, W - 6, 5.6, 'F');
    font('bold', 6.8); ink(C.grisBleuClair);
    txt('DATE', L + 5, y + 3.9); txt('INTERVENTION', L + 26, y + 3.9); txt('INTERVENANT', L + 71, y + 3.9); txt('OBSERVATION', L + 103, y + 3.9);
    y += 6.4;
  }
  actifsListe.forEach(function(x){
    var hd = 40 + (x.autres.length ? 8 : 0);
    if(groupe !== x.type){
      besoin(hd + 30);
      groupe = x.type;
      fill(C.nuit); rpArrondiPDF(doc, L, y, W, 8, 2, 'F');
      font('bold', 9.5); ink(C.blanc); txt(groupe.toUpperCase(), L + 5, y + 5.4);
      var cnt = actifsListe.filter(function(q){ return q.type === groupe; }).length;
      font('normal', 8); ink(C.ambreClair); txt(cnt + ' équipement' + (cnt > 1 ? 's' : ''), L + W - 5, y + 5.4, { align:'right' });
      y += 11;
    }else besoin(hd + 18);
    /* fiche */
    fill(C.blanc); draw(C.ligne); doc.setLineWidth(0.3); rpArrondiPDF(doc, L, y, W, hd, 2.5, 'FD');
    var cs = couleurStatut(x.statut); fill(cs); doc.rect(L, y + 3, 1.6, hd - 6, 'F');
    font('bold', 10.5); ink(C.nuit); txt(coupe(x.e.nom, 100), L + 6, y + 7);
    font('normal', 7.8); ink(C.muet); txt((x.e.serial_value ? 'N° ' + x.e.serial_value + '   -   ' : '') + x.type, L + 6, y + 12);
    pastille(L + 106, y + 4, 44, x.statut, libStatut(x));
    var tok = tokens[x.e.id], img = tok ? qr(base + '#/p/' + tok) : null;
    if(img){ try{ doc.addImage(img, 'PNG', L + W - 19, y + 3, 15, 15); font('normal', 5.4); ink(C.muet); txt('FICHE EN LIGNE', L + W - 11.5, y + 20.2, { align:'center' }); }catch(e){} }
    function cell(cx, cy, lab, val){ font('normal', 6.4); ink(C.muet); txt(lab.toUpperCase(), cx, cy); font('bold', 8.4); ink(C.nuit); txt(coupe(val || '-', 52), cx, cy + 4.4); }
    cell(L + 6, y + 24, 'Emplacement', x.empl || 'non renseigné');
    cell(L + 62, y + 24, x.mise ? 'Mise en service' : 'Fiche créée le', fd(x.mise || x.e.created_at));
    cell(L + 108, y + 24, 'Dernier contrôle / intervention', x.dernier ? fd(x.dernier) : '');
    cell(L + 6, y + 34, x.next ? x.next.lab : 'Prochaine échéance', x.next ? fd(x.next.date) : 'non renseignée');
    cell(L + 62, y + 34, 'Interventions (période)', String(x.ivs.length));
    cell(L + 108, y + 34, 'Intervenants', x.techs.join(', '));
    if(x.autres.length){ font('normal', 7.2); ink(C.bleuTexte); var au = doc.splitTextToSize(T(x.autres.join('   -   ')), W - 12); doc.text(au.slice(0, 1), L + 6, y + hd - 3); }
    y += hd + 2;
    /* historique */
    if(!x.ivs.length){
      font('normal', 8); ink(C.muet); txt('Aucune intervention enregistrée sur la période.', L + 4, y + 4); y += 9;
    }else{
      besoin(16); enteteTab();
      var liste = x.ivs.slice(0, 30);
      liste.forEach(function(iv){
        font('normal', 7.6);
        var nat = doc.splitTextToSize(T((iv.type || '-') + ((iv.photos && iv.photos.length) ? '  (' + iv.photos.length + ' photo' + (iv.photos.length > 1 ? 's' : '') + ')' : '')), 42);
        var ob = doc.splitTextToSize(T(iv.description || '-'), 82);
        if(ob.length > 4) ob = ob.slice(0, 4).concat([]);
        var nl = Math.max(nat.length, ob.length, 1), h = nl * 3.5 + 2.4;
        if(y + h > BAS){ pageContenu(); font('bold', 8); ink(C.muet); txt('Suite - ' + coupe(x.e.nom, 120), L, y); y += 5; enteteTab(); }
        font('bold', 7.6); ink(C.nuit); txt(fd(iv.date), L + 5, y + 3.4);
        font('normal', 7.6); ink(C.bleuTexte); doc.text(nat.slice(0, 3), L + 26, y + 3.4);
        txt(coupe(iv.technicien || '-', 30), L + 71, y + 3.4);
        doc.text(ob, L + 103, y + 3.4);
        y += h; draw(C.ligne); doc.setLineWidth(0.2); doc.line(L + 3, y - 0.6, L + W - 3, y - 0.6);
      });
      if(x.ivs.length > 30){ font('normal', 7.4); ink(C.muet); txt('... ' + (x.ivs.length - 30) + ' intervention(s) plus ancienne(s) : voir l\'export Excel complet.', L + 5, y + 3); y += 6; }
      y += 5;
    }
  });
  /* Archivés */
  var archives = m.eqs.filter(function(x){ return x.e.archived; });
  if(archives.length){
    besoin(30);
    fill(C.grisBleuClair); rpArrondiPDF(doc, L, y, W, 8, 2, 'F');
    font('bold', 9.5); ink(C.blanc); txt('ÉQUIPEMENTS SORTIS DU PARC', L + 5, y + 5.4);
    font('normal', 8); ink([225, 231, 236]); txt(archives.length + ' archivé' + (archives.length > 1 ? 's' : ''), L + W - 5, y + 5.4, { align:'right' });
    y += 11;
    archives.forEach(function(x){
      besoin(12);
      fill(C.blanc); draw(C.ligne); rpArrondiPDF(doc, L, y, W, 10.5, 2, 'FD');
      font('bold', 8.6); ink(C.nuit); txt(coupe(x.e.nom, 74), L + 4, y + 4.6);
      font('normal', 7.4); ink(C.muet); txt((x.e.serial_value ? 'N° ' + x.e.serial_value + '  -  ' : '') + x.type + (x.e.archived_at ? '  -  archivé le ' + fd(x.e.archived_at) : ''), L + 4, y + 8.6);
      font('normal', 7.8); ink(C.bleuTexte); txt(coupe(x.e.archive_reason || 'Motif non précisé', 66), L + W - 4, y + 6.6, { align:'right' });
      y += 12;
    });
  }

  /* ===== 4. Traçabilité ===== */
  var refUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  if(o.trace){
    var ev = [];
    m.eqs.forEach(function(x){
      if(x.e.created_at && (!m.debut || String(x.e.created_at).slice(0, 10) >= m.debut)) ev.push({ t:x.e.created_at, lib:'Fiche équipement créée', eq:x.e.nom, par:'' });
      x.ivs.forEach(function(iv){
        if(iv.modifie_le && (!m.debut || String(iv.modifie_le).slice(0, 10) >= m.debut)) ev.push({ t:iv.modifie_le, lib:'Intervention modifiée : ' + (iv.type || '-'), eq:x.e.nom, par:(iv.modifie_par && !refUuid.test(iv.modifie_par)) ? iv.modifie_par : 'utilisateur du compte' });
      });
      if(x.e.archived && x.e.archived_at && (!m.debut || String(x.e.archived_at).slice(0, 10) >= m.debut)) ev.push({ t:x.e.archived_at, lib:'Équipement archivé' + (x.e.archive_reason ? ' : ' + x.e.archive_reason : ''), eq:x.e.nom, par:'' });
    });
    ev.sort(function(a, b){ return String(b.t).localeCompare(String(a.t)); });
    pageContenu();
    titre(3, 'Annexe de traçabilité', 'Journal des créations de fiches, modifications d\'interventions et archivages sur la période');
    function enteteTr(){
      fill([232, 236, 239]); doc.rect(L, y, W, 6, 'F'); font('bold', 6.8); ink(C.grisBleuClair);
      txt('DATE ET HEURE', L + 2, y + 4.1); txt('ÉVÉNEMENT', L + 32, y + 4.1); txt('ÉQUIPEMENT', L + 98, y + 4.1); txt('PAR', L + 141, y + 4.1); y += 7;
    }
    enteteTr();
    var max = 260;
    ev.slice(0, max).forEach(function(e){
      besoin(8); if(y === 26) enteteTr();
      font('normal', 7.4); ink(C.bleuTexte);
      txt(fdt(e.t), L + 2, y + 3.6);
      ink(C.nuit); txt(coupe(e.lib, 63), L + 32, y + 3.6);
      ink(C.bleuTexte); txt(coupe(e.eq, 40), L + 98, y + 3.6); txt(coupe(e.par || '-', 28), L + 141, y + 3.6);
      y += 6.2; draw(C.ligne); doc.setLineWidth(0.2); doc.line(L, y - 1.1, L + W, y - 1.1);
    });
    if(ev.length > max){ y += 2; font('normal', 7.6); ink(C.muet); txt('... ' + (ev.length - max) + ' événement(s) plus ancien(s) non repris ici : disponibles dans l\'export Excel.', L, y + 3); y += 6; }
    if(!ev.length){ font('normal', 8.5); ink(C.muet); txt('Aucune création, modification ou archivage enregistré sur la période.', L, y + 4); }
  }

  /* ===== 5. Attestation ===== */
  pageContenu();
  titre(o.trace ? 4 : 3, 'Attestation et validation', 'À signer par le responsable avant remise du dossier');
  fill(C.blanc); draw(C.ligne); doc.setLineWidth(0.3); rpArrondiPDF(doc, L, y, W, 46, 3, 'FD');
  font('normal', 9.2); ink(C.bleuTexte);
  var att = doc.splitTextToSize(T('Le présent dossier a été extrait du registre numérique WiTracEQUIP de l\'établissement « ' + client + ' » le ' + fd(auj()) + (auteur ? ', par ' + auteur : '') + '. Il reprend, à cette date, ' + m.tot.n + ' équipement(s) en service, leurs échéances de contrôle et ' + m.tot.ivTous + ' intervention(s) enregistrée(s) sur la période « ' + libPeriode(o.periode).toLowerCase() + ' ». Les données sont celles saisies par l\'établissement et ses prestataires ; ce dossier ne remplace ni les rapports officiels des organismes de contrôle, ni les certificats de conformité.'), W - 14);
  doc.text(att, L + 7, y + 9, { lineHeightFactor:1.4 });
  y += 54;
  var bl = [['Le responsable de l\'établissement', 'Nom, fonction, signature'], ['Cachet de l\'établissement', 'Date : ____ / ____ / ________']];
  bl.forEach(function(b, i){
    var x = L + i * 88;
    fill(C.ivoire); draw(C.sableBord); doc.setLineWidth(0.4); rpArrondiPDF(doc, x, y, 82, 46, 3, 'FD');
    font('bold', 9); ink(C.nuit); txt(b[0], x + 5, y + 8); font('normal', 7.6); ink(C.muet); txt(b[1], x + 5, y + 13);
    draw(C.grisBleu); doc.setLineWidth(0.3); doc.line(x + 5, y + 38, x + 77, y + 38);
  });
  y += 56;
  var img2 = qr(base);
  fill(C.nuit); rpArrondiPDF(doc, L, y, W, 40, 3, 'F');
  if(img2){ fill(C.blanc); rpArrondiPDF(doc, L + 6, y + 6, 28, 28, 2.5, 'F'); try{ doc.addImage(img2, 'PNG', L + 8, y + 8, 24, 24); }catch(e){} }
  font('bold', 11.5); ink(C.blanc); txt('Votre registre reste vivant', L + 42, y + 13);
  font('normal', 8.6); ink(C.grisBleu);
  var vi = doc.splitTextToSize(T('Ce PDF est une photographie à la date du ' + fd(auj()) + '. Retrouvez l\'état à jour de chaque équipement en scannant son QR code, ou en vous connectant à WiTracEQUIP. Référence du dossier : ' + m.ref + '.'), W - 52);
  doc.text(vi, L + 42, y + 20, { lineHeightFactor:1.35 });
  font('bold', 8.6); ink(C.ambreClair); txt(base.replace(/^https?:\/\//, '').replace(/\/$/, ''), L + 42, y + 35);

  /* ===== Pieds de page ===== */
  var N = doc.getNumberOfPages();
  for(var i = 2; i <= N; i++){
    doc.setPage(i); draw(C.ligne); doc.setLineWidth(0.3); doc.line(L, 285, L + W, 285);
    font('normal', 7); ink(C.muet);
    txt('WiTracEQUIP  -  Dossier de contrôle  -  Réf. ' + m.ref, L, 290);
    txt('Page ' + i + ' / ' + N, L + W, 290, { align:'right' });
  }
  return { blob:doc.output('blob'), pages:N, ref:m.ref };
}

async function generer(){
  if(ETAT.enCours) return;
  ETAT.enCours = true; rendreModale();
  try{
    var r = await fabriquerPdf(ETAT.d, OPT);
    var nom = ('Dossier_de_controle_' + String(ETAT.d.client || '').replace(/\(démonstration\)/, 'demo') + '_' + auj())
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_') + '.pdf';
    var url = URL.createObjectURL(r.blob);
    var a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    window.__dcDernier = { url:url, nom:nom, pages:r.pages, ref:r.ref };
    toast('Dossier de contrôle prêt (' + r.pages + ' pages) : ' + nom);
    ETAT.enCours = false; fermer();
  }catch(e){
    ETAT.enCours = false; rendreModale();
    try{ toast('Dossier impossible : ' + (e.message || e), 'erreur'); }catch(_){}
  }
}

window.dossierControle = { ouvrir:ouvrir, fermer:fermer, modele:modele, fabriquer:fabriquerPdf, options:OPT, preparerDemo:preparerDemo };
})();
