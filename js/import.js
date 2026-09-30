/* ======================================================================
   WiTracEQUIP - Import intelligent d'un parc existant (Excel / CSV)
   ----------------------------------------------------------------------
   Réservé au fondateur et aux administrateurs. Le fichier est lu sur
   l'appareil (aucun envoi avant validation). L'assistant :
     - lit .xlsx (lecteur maison : ZIP + XML) et .csv/.tsv/.txt (séparateur et
       encodage détectés),
     - repère la ligne d'en-têtes, ignore titres, lignes vides et totaux,
     - devine le rôle de chaque colonne (nom, n° de série, type, dates,
       nombres, texte) d'après son titre ET son contenu,
     - rapproche les types du fichier des types existants (tolérant aux
       fautes, accents, pluriels) ou propose de les créer,
     - convertit dates (série Excel, 12/03/2024, 12 mars 2024...) et nombres
       (1 234,5), détecte les doublons (dans le fichier et dans le parc),
     - montre un aperçu à valider, puis crée types + équipements par lots.
   Module additif : s'il échoue, le reste de l'application n'est pas touché.
   ====================================================================== */
(function(){
'use strict';

var MAX_LIGNES = 3000, MAX_COLS = 60, LOT = 100;
var S = null;

function autorise(){
  try{ return (typeof isSuperAdmin === 'function' && isSuperAdmin()) || (typeof isAdmin === 'function' && isAdmin()); }catch(e){ return false; }
}
function h(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function p2(n){ return String(n).padStart(2, '0'); }
function norm(s){
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function sing(w){ return w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w; }
function jetons(s){ return norm(s).split(' ').filter(Boolean).map(sing); }
function cle(s){ return jetons(s).join(' '); }
function alnum(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function slug(s){ return (typeof slugify === 'function') ? slugify(s) : norm(s).replace(/ /g, '_'); }

function lev(a, b){
  var m = a.length, n = b.length; if(!m) return n; if(!n) return m;
  var prev = [], cur = [], i, j;
  for(j = 0; j <= n; j++) prev[j] = j;
  for(i = 1; i <= m; i++){
    cur = [i];
    for(j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function sim(a, b){
  var ka = cle(a), kb = cle(b);
  if(!ka || !kb) return 0;
  if(ka === kb) return 1;
  var ta = ka.split(' '), tb = kb.split(' ');
  var inter = ta.filter(function(t){ return tb.indexOf(t) >= 0; }).length;
  var sub = (inter === ta.length || inter === tb.length) ? 0.86 : 0;
  var jac = inter / (ta.length + tb.length - inter);
  var l = 1 - lev(ka, kb) / Math.max(ka.length, kb.length);
  return Math.max(sub, jac, l);
}
function joli(s){
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if(s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.charAt(0) + s.slice(1).toLowerCase();
  return s;
}

/* ---------------- Lecture ZIP / XLSX ---------------- */
function utf8(u8){ return new TextDecoder('utf-8').decode(u8); }
async function ouvrirZip(buf){
  var dv = new DataView(buf), u8 = new Uint8Array(buf), i = u8.length - 22;
  while(i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
  if(i < 0) throw new Error('Ce fichier n’est pas un classeur Excel valide.');
  var n = dv.getUint16(i + 10, true), p = dv.getUint32(i + 16, true), fichiers = {};
  for(var k = 0; k < n; k++){
    if(dv.getUint32(p, true) !== 0x02014b50) break;
    var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    fichiers[utf8(u8.subarray(p + 46, p + 46 + nl))] = { m:dv.getUint16(p + 10, true), c:dv.getUint32(p + 20, true), o:dv.getUint32(p + 42, true) };
    p += 46 + nl + el + cl;
  }
  return async function(nom){
    var f = fichiers[nom]; if(!f) return null;
    var lnl = dv.getUint16(f.o + 26, true), lel = dv.getUint16(f.o + 28, true), d = f.o + 30 + lnl + lel;
    var data = u8.subarray(d, d + f.c);
    if(f.m === 0) return data;
    if(typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas ouvrir un fichier Excel : enregistrez-le en CSV et réessayez.');
    var flux = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  };
}
function xml(u8){ return new DOMParser().parseFromString(utf8(u8), 'application/xml'); }
function colIdx(ref){
  var m = /^([A-Z]+)/.exec(ref || ''); if(!m) return 0;
  var n = 0; for(var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return n - 1;
}
function serialIso(s){
  var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(s) * 86400000);
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
}
var FMT_DATE_INTEGRES = { 14:1, 15:1, 16:1, 17:1, 18:1, 19:1, 20:1, 21:1, 22:1, 27:1, 28:1, 29:1, 30:1, 31:1, 32:1, 33:1, 34:1, 35:1, 36:1, 45:1, 46:1, 47:1, 50:1, 51:1, 52:1, 53:1, 54:1, 55:1, 56:1, 57:1, 58:1 };
function texteNoeud(si){
  var out = '', ts = si.getElementsByTagName('t');
  for(var i = 0; i < ts.length; i++){
    var par = ts[i].parentNode;
    if(par && par.nodeName === 'rPh') continue;
    out += ts[i].textContent;
  }
  return out;
}
async function lireXlsx(buf){
  var lire = await ouvrirZip(buf);
  var wb = await lire('xl/workbook.xml'); if(!wb) throw new Error('Classeur Excel illisible.');
  var wbx = xml(wb), rels = {};
  var relu = await lire('xl/_rels/workbook.xml.rels');
  if(relu){ var rx = xml(relu).getElementsByTagName('Relationship'); for(var a = 0; a < rx.length; a++) rels[rx[a].getAttribute('Id')] = rx[a].getAttribute('Target'); }
  var partages = [], ss = await lire('xl/sharedStrings.xml');
  if(ss){ var sis = xml(ss).getElementsByTagName('si'); for(var b = 0; b < sis.length; b++) partages.push(texteNoeud(sis[b])); }
  var dateXf = {}, st = await lire('xl/styles.xml');
  if(st){
    var sx = xml(st), perso = {}, nf = sx.getElementsByTagName('numFmt');
    for(var c = 0; c < nf.length; c++){
      var code = (nf[c].getAttribute('formatCode') || '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
      perso[nf[c].getAttribute('numFmtId')] = /[dmyhs]/i.test(code) && !/^[#0.,%\s]*$/.test(code);
    }
    var cx = sx.getElementsByTagName('cellXfs')[0], xfs = cx ? cx.getElementsByTagName('xf') : [];
    for(var d = 0; d < xfs.length; d++){
      var id = xfs[d].getAttribute('numFmtId');
      if(FMT_DATE_INTEGRES[id] || perso[id]) dateXf[d] = true;
    }
  }
  var feuilles = [], sh = wbx.getElementsByTagName('sheet');
  for(var e = 0; e < sh.length; e++){
    if(sh[e].getAttribute('state') && sh[e].getAttribute('state') !== 'visible') continue;
    var rid = sh[e].getAttribute('r:id') || sh[e].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    var cible = (rels[rid] || ('worksheets/sheet' + (e + 1) + '.xml')).replace(/^\//, '');
    var chemin = /^xl\//.test(cible) ? cible : 'xl/' + cible;
    var sd = await lire(chemin); if(!sd) continue;
    var rows = [], rs = xml(sd).getElementsByTagName('row');
    for(var r = 0; r < rs.length && rows.length < MAX_LIGNES + 40; r++){
      var ri = (+rs[r].getAttribute('r') || (r + 1)) - 1, cells = rs[r].getElementsByTagName('c'), ligne = [];
      for(var q = 0; q < cells.length; q++){
        var ce = cells[q], j = colIdx(ce.getAttribute('r')); if(j >= MAX_COLS) continue;
        var t = ce.getAttribute('t'), vn = ce.getElementsByTagName('v')[0], v = vn ? vn.textContent : '', val = '';
        if(t === 's') val = partages[+v] != null ? partages[+v] : '';
        else if(t === 'inlineStr'){ var is = ce.getElementsByTagName('is')[0]; val = is ? texteNoeud(is) : ''; }
        else if(t === 'str' || t === 'e') val = t === 'e' ? '' : v;
        else if(t === 'b') val = v === '1' ? 'oui' : 'non';
        else if(v !== ''){
          var num = +v;
          val = (dateXf[+ce.getAttribute('s')] && num > 0 && num < 80000) ? { s:num } : num;
        }
        ligne[j] = val;
      }
      while(rows.length < ri && rows.length < MAX_LIGNES + 40) rows.push([]);
      rows[ri] = ligne;
    }
    feuilles.push({ nom:sh[e].getAttribute('name') || ('Feuille ' + (e + 1)), rows:rows });
  }
  if(!feuilles.length) throw new Error('Aucune feuille lisible dans ce classeur.');
  return feuilles;
}

/* ---------------- CSV ---------------- */
function lireCsv(buf, nom){
  var u8 = new Uint8Array(buf), texte;
  try{ texte = new TextDecoder('utf-8', { fatal:true }).decode(u8); }catch(e){ texte = new TextDecoder('windows-1252').decode(u8); }
  texte = texte.replace(/^﻿/, '');
  var ech = texte.split(/\r?\n/).slice(0, 8).join('\n'), best = ';', bn = -1;
  [';', ',', '\t', '|'].forEach(function(s){ var n = ech.split(s).length; if(n > bn){ bn = n; best = s; } });
  var rows = [], ligne = [], cel = '', q = false;
  for(var i = 0; i < texte.length && rows.length < MAX_LIGNES + 40; i++){
    var ch = texte[i];
    if(q){
      if(ch === '"'){ if(texte[i + 1] === '"'){ cel += '"'; i++; } else q = false; }
      else cel += ch;
    }else if(ch === '"') q = true;
    else if(ch === best){ ligne.push(cel); cel = ''; }
    else if(ch === '\n' || ch === '\r'){
      if(ch === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cel); cel = ''; rows.push(ligne); ligne = [];
    }else cel += ch;
  }
  if(cel !== '' || ligne.length){ ligne.push(cel); rows.push(ligne); }
  return [{ nom:String(nom || 'Fichier').replace(/\.[^.]+$/, ''), rows:rows.map(function(l){ return l.slice(0, MAX_COLS); }) }];
}

/* ---------------- Valeurs ---------------- */
var MOIS = { janvier:1, janv:1, jan:1, january:1, fevrier:2, fev:2, feb:2, february:2, mars:3, mar:3, march:3, avril:4, avr:4, apr:4, april:4, mai:5, may:5,
  juin:6, jun:6, june:6, juillet:7, juil:7, jul:7, july:7, aout:8, aou:8, aug:8, august:8, septembre:9, sept:9, sep:9, september:9,
  octobre:10, oct:10, october:10, novembre:11, nov:11, november:11, decembre:12, dec:12, december:12 };
function isoOk(y, m, d){
  if(y < 100) y += y <= 70 ? 2000 : 1900;
  if(y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  var t = new Date(y, m - 1, d);
  if(t.getMonth() !== m - 1) return null;
  return y + '-' + p2(m) + '-' + p2(d);
}
function dateDe(v, forceNombre){
  if(v == null || v === '') return null;
  if(typeof v === 'object' && v.s != null) return serialIso(v.s);
  if(typeof v === 'number') return (forceNombre && v > 20000 && v < 80000) ? serialIso(v) : null;
  var s = String(v).trim(), m;
  if(!s) return null;
  if((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s].*)?$/.exec(s))) return isoOk(+m[1], +m[2], +m[3]);
  if((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:\s.*)?$/.exec(s))){
    var a = +m[1], b = +m[2];
    if(b > 12 && a <= 12){ var t = a; a = b; b = t; }
    return isoOk(+m[3], b, a);
  }
  if((m = /^(\d{1,2})(?:er)?\s+([a-zA-ZÀ-ſ.]+)\s+(\d{2,4})$/.exec(s))){
    var mo = MOIS[norm(m[2]).replace(/ /g, '')]; if(mo) return isoOk(+m[3], mo, +m[1]);
  }
  if((m = /^([a-zA-ZÀ-ſ.]+)\s+(\d{4})$/.exec(s))){
    var mo2 = MOIS[norm(m[1]).replace(/ /g, '')]; if(mo2) return isoOk(+m[2], mo2, 1);
  }
  if((m = /^(\d{1,2})[\/.-](\d{4})$/.exec(s))) return isoOk(+m[2], +m[1], 1);
  if(forceNombre && /^\d{5}$/.test(s) && +s > 20000 && +s < 80000) return serialIso(+s);
  return null;
}
function nombreDe(v){
  if(typeof v === 'number') return v;
  if(v == null || typeof v === 'object') return null;
  var s = String(v).replace(/[  \s]/g, '');
  var m = /^(-?\d+(?:[.,]\d+)*)([a-zA-Z%°³²\/µΩΩ]{0,8})$/.exec(s);
  if(!m) return null;
  var n = m[1], p = Math.max(n.lastIndexOf(','), n.lastIndexOf('.'));
  if(p >= 0){
    var apres = n.length - p - 1, sep = (n.match(/[.,]/g) || []).length;
    if(sep > 1 || apres === 3 && /^\d{1,3}[.,]\d{3}$/.test(n) && false) n = n.replace(/[.,]/g, '');
    else n = n.replace(',', '.');
  }
  var x = parseFloat(n); return isNaN(x) ? null : x;
}
function txt(v){
  if(v == null) return '';
  if(typeof v === 'object' && v.s != null) return serialIso(v.s);
  if(typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toPrecision(12));
  return String(v).replace(/\s+/g, ' ').trim();
}
function vide(v){ return v == null || (typeof v === 'string' && !v.trim()); }

/* ---------------- Analyse des colonnes ---------------- */
function scoreNom(hn){
  if(/designation|libelle|intitule|nom (de l )?(equipement|appareil|materiel|machine|engin)|nom du (materiel|produit)/.test(hn)) return 0.95;
  if(/^(nom|equipement|appareil|materiel|machine|engin|vehicule|article|produit|element)$/.test(hn)) return 0.9;
  if(/^(description|modele|reference|libelle court)$/.test(hn)) return 0.55;
  if(/\bnom\b/.test(hn)) return 0.6;
  return 0;
}
function scoreSerie(hn){
  if(/numero de serie|n de serie|no serie|serie|serial|^sn$|^s n$|imei|immat|plaque|matricule|vin\b/.test(hn)) return 0.95;
  if(/inventaire|asset|repere|code barre|code interne|identifiant|^id$|numero d equipement|n equipement/.test(hn)) return 0.72;
  if(/^(n|no|num|numero|ref|reference)$/.test(hn)) return 0.42;
  return 0;
}
function scoreType(hn){
  if(/^(type|categorie|famille|nature|classe|genre|sous type|type d equipement|type equipement|categorie d equipement|type de materiel)$/.test(hn)) return 0.92;
  if(/^type\b|categorie|famille/.test(hn)) return 0.7;
  return 0;
}
function detecterEntete(rows){
  var meilleur = -1, scores = [], lim = Math.min(rows.length, 25), i;
  for(i = 0; i < lim; i++){
    var l = rows[i] || [], n = 0;
    for(var j = 0; j < l.length; j++){ var v = l[j]; if(!vide(v) && typeof v !== 'number' && !(typeof v === 'object') && nombreDe(v) === null && dateDe(v) === null) n++; }
    scores.push(n); if(n > meilleur) meilleur = n;
  }
  if(meilleur < 1) return 0;
  for(i = 0; i < scores.length; i++) if(scores[i] >= Math.max(2, meilleur * 0.7) || (meilleur < 2 && scores[i] >= 1)) return i;
  return 0;
}
function analyser(){
  var f = S.classeur[S.feuille], rows = f.rows, ent = S.entete = detecterEntete(rows);
  var tete = rows[ent] || [], nCols = 0, r;
  for(r = ent; r < Math.min(rows.length, ent + 300); r++) nCols = Math.max(nCols, (rows[r] || []).length);
  nCols = Math.min(Math.max(nCols, tete.length), MAX_COLS);
  var donnees = [];
  for(r = ent + 1; r < rows.length && donnees.length < MAX_LIGNES; r++){
    var l = rows[r] || [], plein = 0, tot = false;
    for(var j = 0; j < nCols; j++) if(!vide(l[j])) plein++;
    if(!plein) continue;
    if(plein <= 2 && /^(total|sous total|somme|nombre)/.test(norm(txt(l.filter(function(x){ return !vide(x); })[0])))) tot = true;
    if(tot) continue;
    donnees.push({ n:r + 1, v:l });
  }
  S.donnees = donnees;
  var cols = [];
  for(var c = 0; c < nCols; c++){
    var hb = txt(tete[c]), vals = [], dateN = 0, numN = 0, txtN = 0, ent2 = 0, seq = true, prev = null;
    var vus = {}, dist = 0;
    donnees.forEach(function(d){
      var v = d.v[c]; if(vide(v)) return; vals.push(v);
      var k = alnum(txt(v)); if(!vus[k]){ vus[k] = 1; dist++; }
    });
    vals.forEach(function(v){
      if(dateDe(v, false) && !(typeof v === 'number')) dateN++;
      else if(nombreDe(v) !== null) numN++; else txtN++;
      var x = typeof v === 'number' ? v : nombreDe(v);
      if(x !== null && Number.isInteger(x)){ ent2++; if(prev !== null && x !== prev + 1) seq = false; prev = x; } else seq = false;
    });
    var nb = vals.length;
    cols.push({ j:c, h:hb || ('Colonne ' + (c + 1)), hn:norm(hb), sansTitre:!hb, fill:nb / Math.max(1, donnees.length), n:nb, dist:dist, distR:nb ? dist / nb : 0,
      dateR:nb ? dateN / nb : 0, numR:nb ? numN / nb : 0, seq:seq && nb > 3,
      ex:vals.slice(0, 3).map(function(v){ return txt(v); }), role:'champ', conf:0, ftype:'text', label:joli(hb || ('Colonne ' + (c + 1))), inclure:true });
  }
  /* Rôles d'après titres puis contenu */
  var pris = {};
  function attribuer(role, fn, seuil){
    var b = null, bs = 0;
    cols.forEach(function(k){ if(pris[k.j]) return; var s = fn(k); if(s > bs){ bs = s; b = k; } });
    if(b && bs >= seuil){ b.role = role; b.conf = bs; pris[b.j] = true; }
  }
  cols.forEach(function(k){
    if(k.n === 0 || k.fill < 0.03){ k.role = 'ignorer'; pris[k.j] = true; }
    else if(k.seq && /^(n|no|num|numero|#|ligne|index|id|rang|item)?$/.test(k.hn)){ k.role = 'ignorer'; pris[k.j] = true; }
  });
  attribuer('type', function(k){
    var s = scoreType(k.hn); if(!s) return 0;
    if(k.dist > 40 || (k.n > 12 && k.distR > 0.7)) return 0; return s;
  }, 0.6);
  attribuer('nom', function(k){ var s = scoreNom(k.hn); return (k.dateR > 0.6 || k.numR > 0.8) ? 0 : s; }, 0.5);
  attribuer('serie', function(k){ return scoreSerie(k.hn); }, 0.4);
  if(!cols.some(function(k){ return k.role === 'nom'; })){
    attribuer('nom', function(k){
      if(k.dateR > 0.5 || k.numR > 0.5 || k.n < 2) return 0;
      return 0.35 + Math.min(0.2, k.distR * 0.2) + Math.min(0.1, k.fill * 0.1);
    }, 0.3);
  }
  if(!cols.some(function(k){ return k.role === 'serie'; })){
    attribuer('serie', function(k){
      if(k.dateR > 0.3 || k.distR < 0.9 || k.n < 3) return 0;
      var ok = 0; donneesSample(k).forEach(function(v){ if(/\d/.test(v) && !/\s/.test(v) && v.length <= 24 && v.length >= 3) ok++; });
      return ok / Math.max(1, donneesSample(k).length) > 0.8 ? 0.45 : 0;
    }, 0.4);
  }
  cols.forEach(function(k){
    if(k.role !== 'champ') return;
    if(k.dateR >= 0.7){ k.ftype = 'date'; k.conf = Math.min(0.98, 0.6 + k.dateR * 0.38); }
    else if(k.numR >= 0.8){ k.ftype = 'number'; k.conf = Math.min(0.95, 0.5 + k.numR * 0.4); }
    else{ k.ftype = 'text'; k.conf = 0.6; if(k.distR > 0.5 && k.n > 30) k.ftype = 'text'; }
    if(k.ftype === 'text' && k.numR >= 0.8) k.ftype = 'number';
  });
  S.cols = cols;
}
function donneesSample(k){
  var out = [];
  for(var i = 0; i < S.donnees.length && out.length < 40; i++){ var v = S.donnees[i].v[k.j]; if(!vide(v)) out.push(txt(v)); }
  return out;
}

/* ---------------- Plan : types, champs, lignes ---------------- */
function typesOrg(){
  var t = (typeof state !== 'undefined' && state.types) ? state.types : [];
  return t.filter(function(x){ return !S.org || x.organization_id === S.org || !x.organization_id; });
}
function colRole(role){ return S.cols.filter(function(k){ return k.role === role; })[0] || null; }
function nomFeuilleGenerique(n){ return /^(feuil|sheet|export|donnees|data|tableau|classeur|fichier|onglet|liste)/.test(norm(n)) || !norm(n); }

function planifier(){
  var kNom = colRole('nom'), kSer = colRole('serie'), kTyp = colRole('type');
  var extras = S.cols.filter(function(k){ return k.role === 'champ' && k.inclure; });
  var existants = typesOrg();
  /* 1. groupes de types */
  var groupes = {}, ordre = [];
  function groupe(brut){
    var k = cle(brut) || '_aucun';
    if(!groupes[k]){
      var g = { cle:k, libelle:joli(brut) || '', nb:0, mode:'nouveau', typeId:'', nom:'' };
      var best = null, bs = 0;
      existants.forEach(function(t){ var s = sim(brut, t.nom); if(s > bs){ bs = s; best = t; } });
      if(best && bs >= 0.72){ g.mode = 'existant'; g.typeId = best.id; g.conf = bs; }
      else{ g.nom = g.libelle; }
      var ov = S.ov[k]; if(ov){ for(var p in ov) g[p] = ov[p]; }
      groupes[k] = g; ordre.push(k);
    }
    return groupes[k];
  }
  if(kTyp){
    S.donnees.forEach(function(d){ var v = txt(d.v[kTyp.j]); groupe(v || '').nb++; });
    if(groupes._aucun){ groupes._aucun.libelle = 'Sans type indiqué'; if(groupes._aucun.mode === 'nouveau' && !S.ov._aucun) groupes._aucun.nom = 'Équipement'; }
  }else{
    var f = S.classeur[S.feuille].nom, g0 = groupe(nomFeuilleGenerique(f) ? '' : f);
    g0.libelle = nomFeuilleGenerique(f) ? 'Tout le fichier' : joli(f);
    if(g0.mode === 'nouveau' && !S.ov._aucun && !(S.ov[g0.cle])) g0.nom = nomFeuilleGenerique(f) ? 'Équipements importés' : joli(f);
    g0.nb = S.donnees.length;
  }
  S.groupes = ordre.map(function(k){ return groupes[k]; });
  /* 2. champs par groupe */
  var pris = {};
  S.groupes.forEach(function(g){
    var champs = [], mapCols = {}, ajouts = [], base = [];
    if(g.mode === 'existant'){
      var t = existants.filter(function(x){ return x.id === g.typeId; })[0];
      base = t ? (t.champs || []) : [];
      champs = base.map(function(c){ return c; });
    }
    var cles = {}; champs.forEach(function(c){ cles[c.key || slug(c.label)] = 1; });
    extras.forEach(function(k){
      var trouve = null, bs = 0;
      base.forEach(function(c){ var s = sim(k.label, c.label); if(s > bs){ bs = s; trouve = c; } });
      if(trouve && bs >= 0.8){ mapCols[k.j] = { key:trouve.key || slug(trouve.label), type:trouve.type || 'text' }; return; }
      var ky = slug(k.label), n = 2; while(cles[ky]){ ky = slug(k.label) + '_' + n++; }
      cles[ky] = 1;
      var nc = { key:ky, label:k.label, type:k.ftype };
      champs.push(nc); ajouts.push(nc); mapCols[k.j] = { key:ky, type:k.ftype };
    });
    g.champs = champs; g.mapCols = mapCols; g.ajouts = ajouts;
    g.cree = g.mode === 'nouveau'; g.maj = g.mode === 'existant' && ajouts.length > 0;
    g.nomFinal = g.mode === 'nouveau' ? (g.nom || g.libelle || 'Équipement') : ((existants.filter(function(x){ return x.id === g.typeId; })[0] || {}).nom || '');
    pris[g.cle] = g;
  });
  /* 3. lignes */
  var dejaSerie = {}, dejaNom = {}, lignes = [];
  var parcSerie = {}, parcNom = {};
  (S.parc || []).forEach(function(e){
    if(e.serial_value) parcSerie[alnum(e.serial_value)] = 1;
    parcNom[alnum(e.nom) + '|' + e.type_id] = 1;
  });
  S.donnees.forEach(function(d){
    var tv = kTyp ? txt(d.v[kTyp.j]) : '', g = pris[kTyp ? (cle(tv) || '_aucun') : S.groupes[0].cle];
    var nom = kNom ? txt(d.v[kNom.j]) : '', serie = kSer ? txt(d.v[kSer.j]) : '', warn = [];
    if(kSer && typeof d.v[kSer.j] === 'number' && d.v[kSer.j] >= 1e15) warn.push('N° de série en notation scientifique : à vérifier dans Excel');
    serie = serie.replace(/\.0$/, '');
    if(!nom && serie) nom = (g.nomFinal || 'Équipement') + ' ' + serie;
    var valeurs = {}, aff = [];
    Object.keys(g.mapCols).forEach(function(j){
      var m = g.mapCols[j], brut = d.v[j], k = S.cols[j];
      if(vide(brut)) return;
      var val;
      if(m.type === 'date'){ val = dateDe(brut, k.ftype === 'date'); if(!val){ warn.push('Date illisible « ' + txt(brut) + ' » (' + k.label + ') : champ laissé vide'); return; } }
      else if(m.type === 'number'){ var nb = nombreDe(brut); if(nb === null){ val = txt(brut); } else val = String(nb); }
      else val = txt(brut);
      valeurs[m.key] = val; aff.push(k.label + ' : ' + (m.type === 'date' ? val.split('-').reverse().join('/') : val));
    });
    var statut = 'ok', info = '';
    if(!nom){ statut = 'vide'; info = 'Ni nom ni n° de série'; }
    else{
      var ks = serie ? alnum(serie) : '', kn = alnum(nom) + '|' + (g.typeId || g.cle);
      if(ks && parcSerie[ks]){ statut = 'doublon-parc'; info = 'Ce n° de série existe déjà dans le parc'; }
      else if(!ks && g.mode === 'existant' && parcNom[alnum(nom) + '|' + g.typeId]){ statut = 'doublon-parc'; info = 'Un équipement du même nom existe déjà'; }
      else if(ks && dejaSerie[ks]){ statut = 'doublon-fichier'; info = 'N° de série déjà vu ligne ' + dejaSerie[ks]; }
      else if(!ks && dejaNom[kn]){ statut = 'doublon-fichier'; info = 'Même nom déjà vu ligne ' + dejaNom[kn]; }
      if(ks && !dejaSerie[ks]) dejaSerie[ks] = d.n;
      if(!ks && !dejaNom[kn]) dejaNom[kn] = d.n;
    }
    var incl = statut === 'ok';
    if(S.excl[d.n] !== undefined) incl = S.excl[d.n] && statut !== 'vide';
    lignes.push({ n:d.n, nom:nom, serie:serie, g:g, valeurs:valeurs, aff:aff, warn:warn, statut:statut, info:info, inclure:incl });
  });
  S.lignes = lignes;
}

/* ---------------- Interface ---------------- */
function injecterStyle(){
  if(document.getElementById('im-style')) return;
  var s = document.createElement('style'); s.id = 'im-style';
  s.textContent =
'.im-fond{position:fixed;inset:0;background:rgba(15,25,35,.62);z-index:9500;display:flex;align-items:center;justify-content:center;padding:12px;}' +
'.im-carte{background:#fff;color:#1f2d38;border-radius:18px;max-width:980px;width:100%;max-height:95vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden;}' +
'.im-tete{background:linear-gradient(135deg,#182b3b,#30495d);color:#fff;padding:18px 22px 15px;position:relative;flex:none;}' +
'.im-tete:after{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:#ef9b31;}' +
'.im-tete h3{margin:0 0 3px;font-size:20px;color:#fff;}.im-tete p{margin:0;font-size:13px;color:#c9d1d8;line-height:1.45;}' +
'.im-etapes{display:flex;gap:6px;margin-top:11px;}.im-etapes i{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.22);}.im-etapes i.on{background:#ef9b31;}' +
'.im-corps{padding:16px 22px 8px;overflow:auto;flex:1 1 auto;}' +
'.im-corps label.t{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6d7880;font-weight:700;margin:14px 0 7px;}' +
'.im-corps select,.im-corps input[type=text]{width:100%;padding:9px 10px;border:1px solid #c9d1d8;border-radius:9px;font-size:14px;background:#fff;color:#1f2d38;box-sizing:border-box;}' +
'.im-depot{border:2px dashed #b7c2cb;border-radius:14px;padding:30px 16px;text-align:center;background:#f7f9fa;cursor:pointer;}' +
'.im-depot.sur{border-color:#ef9b31;background:#fff6e8;}.im-depot b{display:block;font-size:16px;margin-bottom:4px;}.im-depot span{font-size:13px;color:#6d7880;}' +
'.im-compris{background:#fff0d7;border:1px solid #e7cfaa;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;margin-bottom:12px;}' +
'.im-compris b{color:#182b3b;}' +
'.im-tab{width:100%;border-collapse:collapse;font-size:13px;}.im-tab th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#6d7880;padding:6px 8px;border-bottom:2px solid #e3e8ec;white-space:nowrap;}' +
'.im-tab td{padding:7px 8px;border-bottom:1px solid #eef1f3;vertical-align:top;}.im-tab tr.off td{opacity:.45;}' +
'.im-ex{color:#6d7880;font-size:12px;}.im-conf{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;margin-left:6px;}' +
'.im-conf.h{background:#e2f2e9;color:#2e7d52;}.im-conf.m{background:#fff0d7;color:#9a6512;}.im-conf.b{background:#eef1f3;color:#6d7880;}' +
'.im-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:0 0 12px;text-align:center;}' +
'.im-grille div{background:#f3f6f8;border-radius:10px;padding:9px 4px;}.im-grille .v{font-size:23px;font-weight:800;line-height:1.1;color:#182b3b;}.im-grille .l{font-size:11px;color:#6d7880;margin-top:2px;}' +
'.im-grille .g .v{color:#2e7d52;}.im-grille .o .v{color:#c77b12;}.im-grille .r .v{color:#c0392b;}' +
'.im-puce{border:1.5px solid #c9d1d8;background:#fff;color:#34495a;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;font-weight:600;margin:0 6px 6px 0;}.im-puce.on{background:#182b3b;border-color:#182b3b;color:#fff;}' +
'.im-badge{display:inline-block;font-size:11px;font-weight:700;border-radius:6px;padding:2px 7px;white-space:nowrap;}.im-badge.ok{background:#e2f2e9;color:#2e7d52;}.im-badge.dp,.im-badge.df{background:#fff0d7;color:#9a6512;}.im-badge.v{background:#fae4e1;color:#c0392b;}' +
'.im-pied{padding:12px 22px 16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid #eef1f3;flex:none;align-items:center;}' +
'.im-btn{border:0;border-radius:11px;padding:11px 18px;font-size:15px;font-weight:700;cursor:pointer;}.im-btn.s{background:#eef1f3;color:#34495a;}.im-btn.p{background:#ef9b31;color:#182b3b;}.im-btn[disabled]{opacity:.55;cursor:not-allowed;}' +
'.im-note{font-size:12px;color:#6d7880;margin:8px 0;line-height:1.45;}.im-err{background:#fae4e1;color:#8e2b20;border-radius:10px;padding:10px 12px;font-size:13px;margin:10px 0;}' +
'.im-barre{height:12px;background:#e9edf0;border-radius:8px;overflow:hidden;margin:14px 0 6px;}.im-barre i{display:block;height:100%;background:linear-gradient(90deg,#ef9b31,#f6b85f);transition:width .25s;}' +
'.im-scroll{overflow:auto;max-height:44vh;border:1px solid #eef1f3;border-radius:10px;}' +
'.im-lien{background:none;border:0;color:#30495d;text-decoration:underline;cursor:pointer;font-size:13px;padding:0;}' +
'.im-grp{border:1px solid #e3e8ec;border-radius:11px;padding:10px 12px;margin-bottom:8px;display:grid;grid-template-columns:1fr 1.3fr;gap:10px;align-items:center;}' +
'@media(max-width:640px){.im-grp{grid-template-columns:1fr;}.im-corps{padding:14px 14px 6px;}.im-tete{padding:16px 14px 13px;}.im-pied{padding:10px 14px 14px;}.im-tab{font-size:12px;}}';
  document.head.appendChild(s);
}

function confHtml(c){
  if(!c) return '';
  var p = Math.round(c * 100), k = c >= 0.8 ? 'h' : (c >= 0.55 ? 'm' : 'b');
  return '<span class="im-conf ' + k + '">' + p + ' %</span>';
}
var ROLES = [['ignorer', 'Ignorer'], ['nom', 'Nom de l’équipement'], ['serie', 'N° de série / immatriculation'], ['type', 'Type d’équipement'], ['champ', 'Champ personnalisé']];
var FTYPES = [['text', 'Texte'], ['number', 'Nombre'], ['date', 'Date']];

function ecran(){
  var el = document.getElementById('im-fond'); if(!el || !S) return;
  var et = S.etape, num = { choix:1, mapping:2, apercu:3, envoi:4, fin:4 }[et] || 1;
  var corps = '', pied = '';
  if(et === 'choix') corps = ecranChoix();
  else if(et === 'mapping'){ corps = ecranMapping(); }
  else if(et === 'apercu'){ corps = ecranApercu(); }
  else if(et === 'envoi') corps = '<div style="padding:26px 0;text-align:center;"><b style="font-size:17px;">Import en cours…</b><div class="im-barre"><i style="width:' + S.pct + '%"></i></div><div class="im-note">' + h(S.etat) + '</div></div>';
  else if(et === 'fin') corps = ecranFin();
  pied = piedEcran();
  el.innerHTML =
'<div class="im-carte" role="dialog" aria-modal="true" aria-label="Importer un parc existant">' +
'<div class="im-tete"><h3>Importer un parc existant</h3><p>Déposez votre fichier Excel ou CSV : l’assistant repère les colonnes, les types et les doublons, vous vérifiez, puis tout est créé d’un coup.</p>' +
'<div class="im-etapes">' + [1, 2, 3, 4].map(function(i){ return '<i class="' + (i <= num ? 'on' : '') + '"></i>'; }).join('') + '</div></div>' +
'<div class="im-corps">' + (S.erreur ? '<div class="im-err">' + h(S.erreur) + '</div>' : '') + corps + '</div>' +
'<div class="im-pied">' + pied + '</div></div>';
}

function listeClients(){
  try{ return (typeof reglages !== 'undefined' && reglages.clients) ? reglages.clients : []; }catch(e){ return []; }
}
function ecranChoix(){
  var fondateur = typeof isSuperAdmin === 'function' && isSuperAdmin(), out = '';
  if(fondateur){
    var cl = listeClients();
    out += '<label class="t">Client à qui importer le parc</label><select data-im-org>' +
      '<option value="">— Choisir le client —</option>' +
      cl.map(function(c){ return '<option value="' + h(c.id) + '"' + (S.org === c.id ? ' selected' : '') + '>' + h(c.nom) + '</option>'; }).join('') + '</select>';
    if(!cl.length) out += '<div class="im-note">Liste des clients en cours de chargement…</div>';
  }else{
    out += '<div class="im-note" style="margin-top:0;">Les équipements seront ajoutés à votre organisation : <b>' + h((typeof state !== 'undefined' && state.orgName) || '') + '</b>.</div>';
  }
  out += '<label class="t">Votre fichier</label>' +
    '<div class="im-depot" data-im-depot><b>Glissez un fichier ici ou touchez pour le choisir</b><span>Excel (.xlsx) ou CSV · jusqu’à ' + MAX_LIGNES.toLocaleString('fr-FR') + ' lignes · lu sur cet appareil, rien n’est envoyé avant votre validation</span></div>' +
    '<input type="file" data-im-fichier accept=".xlsx,.csv,.tsv,.txt,.xlsm" style="display:none;">' +
    (S.lecture ? '<div class="im-note">Lecture de « ' + h(S.lecture) + ' »…</div>' : '') +
    '<div class="im-note">Aucun format imposé : titres au-dessus du tableau, colonnes dans le désordre, dates au format français, types en majuscules… l’assistant s’adapte. Pas de fichier sous la main ? <button type="button" class="im-lien" data-im-modele>Télécharger un modèle CSV</button>.</div>';
  return out;
}

function ecranMapping(){
  var f = S.classeur[S.feuille], kNom = colRole('nom'), kSer = colRole('serie'), kTyp = colRole('type');
  var champs = S.cols.filter(function(k){ return k.role === 'champ' && k.inclure; });
  var echeances = champs.filter(function(k){ return k.ftype === 'date' && /prochain|echeance|expir|peremption|requalification/.test(k.hn); });
  var nCree = S.groupes.filter(function(g){ return g.cree; }).length, nExist = S.groupes.length - nCree;
  var bilan = '<b>Ce que j’ai compris</b><br>Feuille « ' + h(f.nom) + ' » · <b>' + S.donnees.length + '</b> ligne' + (S.donnees.length > 1 ? 's' : '') + ' d’équipements · ' + S.cols.length + ' colonnes' +
    (S.entete > 0 ? ' (titres ignorés au-dessus de la ligne ' + (S.entete + 1) + ')' : '') + '.<br>' +
    'Nom ← ' + (kNom ? '« ' + h(kNom.h) + ' »' : '<b>non trouvé</b>') + ' · N° de série ← ' + (kSer ? '« ' + h(kSer.h) + ' »' : 'aucune colonne') + ' · Types ← ' + (kTyp ? '« ' + h(kTyp.h) + ' » (' + S.groupes.length + ' valeur' + (S.groupes.length > 1 ? 's' : '') + ')' : 'un seul type pour tout le fichier') + '.<br>' +
    (nExist ? nExist + ' type' + (nExist > 1 ? 's' : '') + ' reconnu' + (nExist > 1 ? 's' : '') + ' dans votre parc' : '') + (nExist && nCree ? ', ' : '') + (nCree ? nCree + ' à créer' : '') + (champs.length ? ' · ' + champs.length + ' champ' + (champs.length > 1 ? 's' : '') + ' repris sur les fiches' : '') + '.' +
    (echeances.length ? '<br>✔ ' + echeances.length + ' colonne' + (echeances.length > 1 ? 's' : '') + ' d’échéance détectée' + (echeances.length > 1 ? 's' : '') + ' (« ' + h(echeances.map(function(k){ return k.label; }).join('», «')) + ' ») : elles alimenteront les rappels et le dossier de contrôle.' : '');
  var sel = S.classeur.length > 1
    ? '<label class="t">Feuille à importer</label><select data-im-feuille>' + S.classeur.map(function(x, i){ return '<option value="' + i + '"' + (i === S.feuille ? ' selected' : '') + '>' + h(x.nom) + '</option>'; }).join('') + '</select>' : '';
  var lignesCols = S.cols.map(function(k){
    var opt = ROLES.map(function(r){ return '<option value="' + r[0] + '"' + ((k.role === 'champ' && !k.inclure ? 'ignorer' : k.role) === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('');
    var det = '';
    if(k.role === 'champ' && k.inclure){
      det = '<input type="text" value="' + h(k.label) + '" data-im-label="' + k.j + '" style="margin-bottom:5px;"><select data-im-ftype="' + k.j + '">' +
        FTYPES.map(function(t){ return '<option value="' + t[0] + '"' + (k.ftype === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>';
    }
    return '<tr><td style="min-width:120px;"><b>' + h(k.h) + '</b>' + (k.role !== 'ignorer' ? confHtml(k.conf) : '') + '<div class="im-ex">' + k.ex.map(h).join(' · ') + '</div></td>' +
      '<td style="min-width:170px;"><select data-im-role="' + k.j + '">' + opt + '</select></td><td style="min-width:150px;">' + det + '</td></tr>';
  }).join('');
  var grp = S.groupes.map(function(g, i){
    var ex = typesOrg();
    var opts = '<option value="__nouveau"' + (g.mode === 'nouveau' ? ' selected' : '') + '>➕ Créer un nouveau type</option>' +
      ex.map(function(t){ return '<option value="' + h(t.id) + '"' + (g.mode === 'existant' && g.typeId === t.id ? ' selected' : '') + '>' + h(t.nom) + '</option>'; }).join('');
    return '<div class="im-grp"><div><b>' + h(g.libelle || 'Sans type') + '</b> <span class="im-ex">· ' + g.nb + ' équipement' + (g.nb > 1 ? 's' : '') + '</span>' +
      (g.mode === 'existant' ? confHtml(g.conf || 1) : '') + '</div><div><select data-im-grp="' + i + '">' + opts + '</select>' +
      (g.mode === 'nouveau' ? '<input type="text" value="' + h(g.nom) + '" data-im-grpnom="' + i + '" style="margin-top:5px;" placeholder="Nom du nouveau type">' : '') +
      (g.mode === 'existant' && g.ajouts.length ? '<div class="im-note" style="margin:5px 0 0;">+ ' + g.ajouts.length + ' champ' + (g.ajouts.length > 1 ? 's' : '') + ' ajouté' + (g.ajouts.length > 1 ? 's' : '') + ' à ce type : ' + h(g.ajouts.map(function(c){ return c.label; }).join(', ')) + '</div>' : '') + '</div></div>';
  }).join('');
  return '<div class="im-compris">' + bilan + '</div>' + sel +
    '<label class="t">Types d’équipements</label>' + (S.groupes.length > 25 ? '<div class="im-err">' + S.groupes.length + ' types différents : la colonne « Type » n’est peut-être pas la bonne. Vérifiez ci-dessous.</div>' : '') + grp +
    '<label class="t">Colonnes du fichier</label><div class="im-scroll"><table class="im-tab"><thead><tr><th>Colonne</th><th>Sert à…</th><th>Détail du champ</th></tr></thead><tbody>' + lignesCols + '</tbody></table></div>' +
    '<div class="im-note">Vous pouvez tout corriger : rôle de chaque colonne, libellé et format des champs, rapprochement des types. Rien n’est créé avant l’étape suivante et votre validation.</div>';
}

function compteurs(){
  var c = { ok:0, incl:0, dp:0, df:0, vide:0, warn:0 };
  S.lignes.forEach(function(l){
    if(l.statut === 'ok') c.ok++; else if(l.statut === 'doublon-parc') c.dp++; else if(l.statut === 'doublon-fichier') c.df++; else c.vide++;
    if(l.inclure) c.incl++; if(l.warn.length) c.warn++;
  });
  return c;
}
function ecranApercu(){
  var c = compteurs(), cree = S.groupes.filter(function(g){ return g.cree; }).length, maj = S.groupes.filter(function(g){ return g.maj; }).length;
  var champsNv = S.groupes.reduce(function(a, g){ return a + (g.mode === 'existant' ? g.ajouts.length : 0); }, 0);
  var fil = S.filtre;
  var vis = S.lignes.filter(function(l){
    return fil === 'tous' ? true : fil === 'ok' ? l.statut === 'ok' : fil === 'dup' ? (l.statut === 'doublon-parc' || l.statut === 'doublon-fichier') : fil === 'warn' ? (l.warn.length || l.statut === 'vide') : true;
  });
  var puce = function(k, lib){ return '<button type="button" class="im-puce' + (fil === k ? ' on' : '') + '" data-im-filtre="' + k + '">' + lib + '</button>'; };
  var lib = { 'ok':['ok', 'Nouveau'], 'doublon-parc':['dp', 'Déjà dans le parc'], 'doublon-fichier':['df', 'Doublon fichier'], 'vide':['v', 'Ignoré'] };
  var corps = vis.slice(0, 150).map(function(l){
    var b = lib[l.statut];
    return '<tr class="' + (l.inclure ? '' : 'off') + '"><td><input type="checkbox" data-im-ligne="' + l.n + '"' + (l.inclure ? ' checked' : '') + (l.statut === 'vide' ? ' disabled' : '') + '></td>' +
      '<td><span class="im-badge ' + b[0] + '">' + b[1] + '</span></td><td><b>' + h(l.nom || '—') + '</b><div class="im-ex">' + (l.serie ? 'N° ' + h(l.serie) : '') + '</div></td>' +
      '<td>' + h(l.g.nomFinal) + (l.g.cree ? ' <span class="im-ex">(nouveau)</span>' : '') + '</td>' +
      '<td class="im-ex">' + h(l.aff.slice(0, 3).join(' · ')) + (l.aff.length > 3 ? ' …' : '') + '</td>' +
      '<td class="im-ex">' + h([l.info].concat(l.warn).filter(Boolean).join(' · ')) + '</td></tr>';
  }).join('');
  return '<div class="im-grille">' +
    '<div class="g"><div class="v">' + c.incl + '</div><div class="l">à importer</div></div>' +
    '<div class="' + ((c.dp + c.df) ? 'o' : '') + '"><div class="v">' + (c.dp + c.df) + '</div><div class="l">doublons repérés</div></div>' +
    '<div class="' + (c.vide ? 'r' : '') + '"><div class="v">' + c.vide + '</div><div class="l">lignes ignorées</div></div>' +
    '<div class="' + (c.warn ? 'o' : '') + '"><div class="v">' + c.warn + '</div><div class="l">à vérifier</div></div>' +
    '<div><div class="v">' + cree + '</div><div class="l">types à créer</div></div>' +
    '<div><div class="v">' + champsNv + '</div><div class="l">champs ajoutés</div></div></div>' +
    '<div class="im-note" style="margin-top:0;">Les doublons sont décochés par défaut (mêmes n° de série ou même nom que dans votre parc ou plus haut dans le fichier). Cochez une ligne pour l’importer quand même.' + (maj ? ' Les types existants concernés reçoivent les nouveaux champs, sans toucher aux fiches déjà saisies.' : '') + '</div>' +
    '<div>' + puce('tous', 'Tout (' + S.lignes.length + ')') + puce('ok', 'Nouveaux (' + c.ok + ')') + puce('dup', 'Doublons (' + (c.dp + c.df) + ')') + puce('warn', 'À vérifier (' + (c.warn + c.vide) + ')') + '</div>' +
    '<div class="im-scroll"><table class="im-tab"><thead><tr><th></th><th>État</th><th>Équipement</th><th>Type</th><th>Détails</th><th>Remarque</th></tr></thead><tbody>' + (corps || '<tr><td colspan="6" class="im-ex">Rien à afficher.</td></tr>') + '</tbody></table></div>' +
    (vis.length > 150 ? '<div class="im-note">150 premières lignes affichées sur ' + vis.length + ' : toutes les lignes cochées seront importées.</div>' : '');
}
function ecranFin(){
  var r = S.resultat || {};
  return '<div style="text-align:center;padding:18px 0 6px;"><div style="font-size:44px;line-height:1;">✅</div><h3 style="margin:10px 0 4px;font-size:20px;">' + r.nb + ' équipement' + (r.nb > 1 ? 's' : '') + ' importé' + (r.nb > 1 ? 's' : '') + '</h3>' +
    '<div class="im-note">' + (r.types ? r.types + ' type' + (r.types > 1 ? 's' : '') + ' créé' + (r.types > 1 ? 's' : '') + ' · ' : '') + (r.maj ? r.maj + ' type' + (r.maj > 1 ? 's' : '') + ' enrichi' + (r.maj > 1 ? 's' : '') + ' · ' : '') +
    'chaque équipement a déjà son QR code, prêt à imprimer depuis sa fiche.</div>' + (r.ech ? '<div class="im-note">' + r.ech + ' échéance' + (r.ech > 1 ? 's' : '') + ' de contrôle reprise' + (r.ech > 1 ? 's' : '') + ' : elles apparaissent dans les rappels de l’accueil.</div>' : '') + '</div>';
}
function piedEcran(){
  var et = S.etape, b = '';
  if(et === 'choix') b = '<button type="button" class="im-btn s" data-im-act="fermer">Annuler</button>';
  else if(et === 'mapping'){
    var ok = !!colRole('nom') || !!colRole('serie');
    b = '<button type="button" class="im-btn s" data-im-act="retour-choix">← Autre fichier</button><button type="button" class="im-btn p" data-im-act="apercu"' + (ok ? '' : ' disabled') + '>Voir l’aperçu →</button>';
  }else if(et === 'apercu'){
    var n = compteurs().incl;
    b = '<button type="button" class="im-btn s" data-im-act="retour-mapping">← Modifier</button><button type="button" class="im-btn p" data-im-act="importer"' + (n && !S.busy ? '' : ' disabled') + '>Importer ' + n + ' équipement' + (n > 1 ? 's' : '') + '</button>';
  }else if(et === 'fin'){
    b = '<button type="button" class="im-btn s" data-im-act="fermer">Fermer</button><button type="button" class="im-btn p" data-im-act="voir">Voir le parc</button>';
  }
  return b;
}

/* ---------------- Actions ---------------- */
function clientsPrets(){
  if(typeof isSuperAdmin !== 'function' || !isSuperAdmin()) return;
  if(listeClients().length) return;
  try{
    if(typeof listClients === 'function') listClients().then(function(l){ reglages.clients = l; if(S && S.etape === 'choix') ecran(); }).catch(function(){});
  }catch(e){}
}
function ouvrir(){
  if(!autorise()){ try{ toast('Import réservé au fondateur et aux administrateurs.', 'erreur'); }catch(e){} return; }
  injecterStyle();
  var org = '';
  try{
    if(isSuperAdmin()){ var m = /#\/reglages\/clients\/([0-9a-f-]{8,})/i.exec(location.hash || ''); if(m) org = m[1]; }
    else org = state.profile.organization_id;
  }catch(e){}
  S = { etape:'choix', org:org, classeur:null, feuille:0, cols:[], donnees:[], groupes:[], lignes:[], ov:{}, excl:{}, filtre:'tous', erreur:'', lecture:'', busy:false, pct:0, etat:'', parc:null };
  var el = document.getElementById('im-fond');
  if(!el){ el = document.createElement('div'); el.id = 'im-fond'; el.className = 'im-fond'; document.body.appendChild(el); }
  ecran(); clientsPrets();
}
function fermer(){ var el = document.getElementById('im-fond'); if(el) el.remove(); S = null; }

async function chargerFichier(file){
  if(!file || !S) return;
  if(typeof isSuperAdmin === 'function' && isSuperAdmin() && !S.org){ S.erreur = 'Choisissez d’abord le client concerné.'; ecran(); return; }
  S.erreur = ''; S.lecture = file.name; ecran();
  try{
    var buf = await file.arrayBuffer(), u8 = new Uint8Array(buf.slice(0, 4));
    var classeur = (u8[0] === 0x50 && u8[1] === 0x4b) ? await lireXlsx(buf) : lireCsv(buf, file.name);
    if(u8[0] === 0xd0 && u8[1] === 0xcf) throw new Error('Ancien format .xls : ouvrez-le dans Excel et enregistrez-le en .xlsx ou en CSV.');
    classeur = classeur.filter(function(f){ return f.rows.some(function(l){ return l && l.some(function(v){ return !vide(v); }); }); });
    if(!classeur.length) throw new Error('Le fichier est vide.');
    /* feuille par défaut : la plus fournie */
    var bi = 0, bn = -1;
    classeur.forEach(function(f, i){ var n = f.rows.reduce(function(a, l){ return a + ((l || []).filter(function(v){ return !vide(v); }).length); }, 0); if(n > bn){ bn = n; bi = i; } });
    S.classeur = classeur; S.feuille = bi; S.ov = {}; S.excl = {};
    await chargerParc();
    analyser(); planifier();
    S.etape = 'mapping'; S.lecture = '';
    if(!S.donnees.length) S.erreur = 'Aucune ligne de données trouvée dans cette feuille.';
  }catch(e){
    S.erreur = 'Lecture impossible : ' + (e.message || e); S.lecture = '';
  }
  ecran();
}
async function chargerParc(){
  S.parc = [];
  try{
    var q = sb.from('equipements').select('id,nom,serial_value,type_id').limit(5000);
    if(S.org) q = q.eq('organization_id', S.org);
    var r = await q; if(!r.error && r.data) S.parc = r.data;
  }catch(e){}
  try{ if(typeof loadTypes === 'function' && !state.typesLoaded) await loadTypes(true); }catch(e){}
}
function recalculer(){ try{ planifier(); }catch(e){ S.erreur = 'Erreur d’analyse : ' + e.message; } ecran(); }

async function importer(){
  if(!S || S.busy) return;
  var aFaire = S.lignes.filter(function(l){ return l.inclure && l.statut !== 'vide'; });
  if(!aFaire.length) return;
  S.busy = true; S.etape = 'envoi'; S.pct = 2; S.etat = 'Préparation…'; S.erreur = ''; ecran();
  var org = S.org, nbTypes = 0, nbMaj = 0, faits = 0;
  try{
    if(!org) throw new Error('Organisation inconnue.');
    var utilises = {}; aFaire.forEach(function(l){ utilises[l.g.cle] = l.g; });
    var ids = {};
    var gs = Object.keys(utilises).map(function(k){ return utilises[k]; });
    for(var i = 0; i < gs.length; i++){
      var g = gs[i];
      if(g.mode === 'existant'){
        ids[g.cle] = g.typeId;
        if(g.ajouts.length){
          S.etat = 'Enrichissement du type « ' + g.nomFinal + ' »…';
          var u = await sb.from('equipment_types').update({ champs:g.champs }).eq('id', g.typeId);
          if(u.error) throw u.error; nbMaj++;
        }
      }else{
        S.etat = 'Création du type « ' + g.nomFinal + ' »…'; ecran();
        var cr = await sb.from('equipment_types').insert({ organization_id:org, nom:g.nomFinal, champs:g.champs }).select('id').single();
        if(cr.error) throw cr.error; ids[g.cle] = cr.data.id; nbTypes++;
      }
    }
    var idAl = (typeof idAleatoire === 'function') ? idAleatoire : function(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); };
    for(var d = 0; d < aFaire.length; d += LOT){
      var lot = aFaire.slice(d, d + LOT).map(function(l){
        return { id:idAl(), public_token:idAl(), organization_id:org, type_id:ids[l.g.cle], nom:l.nom, serial_value:l.serie || null, valeurs:l.valeurs, archived:false };
      });
      S.etat = (faits + 1) + ' à ' + (faits + lot.length) + ' sur ' + aFaire.length + '…'; S.pct = 8 + Math.round(faits / aFaire.length * 90); ecran();
      var ins = await sb.from('equipements').insert(lot);
      if(ins.error) throw ins.error;
      faits += lot.length;
    }
    var ech = 0;
    aFaire.forEach(function(l){ Object.keys(l.valeurs).forEach(function(k){ var c = (l.g.champs || []).filter(function(x){ return (x.key || slug(x.label)) === k; })[0]; if(c && c.type === 'date' && /prochain|[ée]ch[ée]ance/i.test(c.label)) ech++; }); });
    S.resultat = { nb:faits, types:nbTypes, maj:nbMaj, ech:ech };
    try{ if(typeof loadTypes === 'function') await loadTypes(true); }catch(e){}
    try{ reglages.parcs = {}; dashboardCache.items = null; accueilCache.chiffres = null; if(typeof chargerActivite === 'function') chargerActivite(true); }catch(e){}
    S.busy = false; S.etape = 'fin'; ecran();
    try{ render(); }catch(e){}
  }catch(e){
    S.busy = false; S.etape = 'apercu';
    S.erreur = (faits ? faits + ' équipement' + (faits > 1 ? 's' : '') + ' déjà créé' + (faits > 1 ? 's' : '') + ' avant l’erreur. ' : '') + 'Import interrompu : ' + (e.message || e) + (faits ? ' — Relancez l’import : les équipements déjà créés seront repérés comme doublons.' : '');
    if(faits){ try{ await chargerParc(); planifier(); }catch(_){} }
    ecran();
  }
}

function modeleCsv(){
  var l = ['Désignation;N° de série;Catégorie;Marque;Localisation;Date de mise en service;Prochain contrôle',
    'Extincteur CO2 5 kg;EXT-0001;Extincteurs;Sicli;Couloir RDC;12/03/2021;15/09/2027',
    'Chariot élévateur;CE-4471;Levage;Toyota;Entrepôt;03/06/2019;20/01/2027'].join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + l], { type:'text/csv;charset=utf-8' }));
  a.download = 'modele_import_parc.csv'; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------------- Événements ---------------- */
document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest) return;
  if(t.closest('[data-action="import-parc"]')){ e.preventDefault(); ouvrir(); return; }
  var fond = document.getElementById('im-fond'); if(!fond || !S) return;
  if(t === fond){ if(!S.busy) fermer(); return; }
  if(t.closest('[data-im-depot]')){ var fi = fond.querySelector('[data-im-fichier]'); if(fi) fi.click(); return; }
  if(t.closest('[data-im-modele]')){ modeleCsv(); return; }
  var f = t.closest('[data-im-filtre]'); if(f){ S.filtre = f.getAttribute('data-im-filtre'); ecran(); return; }
  var a = t.closest('[data-im-act]'); if(!a) return;
  var act = a.getAttribute('data-im-act');
  if(act === 'fermer'){ if(!S.busy) fermer(); }
  else if(act === 'retour-choix'){ S.etape = 'choix'; S.erreur = ''; ecran(); }
  else if(act === 'retour-mapping'){ S.etape = 'mapping'; S.erreur = ''; ecran(); }
  else if(act === 'apercu'){ S.etape = 'apercu'; S.filtre = 'tous'; S.erreur = ''; recalculer(); }
  else if(act === 'importer') importer();
  else if(act === 'voir'){ var o = S.org; fermer(); try{ nav(isSuperAdmin() && o ? '/reglages/clients/' + o : '/equipements'); }catch(err){} }
});
document.addEventListener('change', function(e){
  var t = e.target; if(!t || !t.hasAttribute || !S || !document.getElementById('im-fond')) return;
  if(t.hasAttribute('data-im-org')){ S.org = t.value; S.erreur = ''; return; }
  if(t.hasAttribute('data-im-fichier')){ chargerFichier(t.files && t.files[0]); return; }
  if(t.hasAttribute('data-im-feuille')){ S.feuille = +t.value; S.ov = {}; S.excl = {}; analyser(); recalculer(); return; }
  if(t.hasAttribute('data-im-role')){
    var k = S.cols[+t.getAttribute('data-im-role')], v = t.value;
    if(v === 'ignorer'){ k.role = 'champ'; k.inclure = false; }
    else{
      if(v !== 'champ') S.cols.forEach(function(o){ if(o !== k && o.role === v){ o.role = 'champ'; o.inclure = true; } });
      k.role = v; k.inclure = true; k.conf = 1;
      if(v === 'champ' && !k.ftype) k.ftype = 'text';
    }
    S.ov = {}; recalculer(); return;
  }
  if(t.hasAttribute('data-im-ftype')){ S.cols[+t.getAttribute('data-im-ftype')].ftype = t.value; recalculer(); return; }
  if(t.hasAttribute('data-im-grp')){
    var g = S.groupes[+t.getAttribute('data-im-grp')], val = t.value;
    S.ov[g.cle] = val === '__nouveau' ? { mode:'nouveau', typeId:'', nom:g.nom || g.libelle } : { mode:'existant', typeId:val, conf:1 };
    recalculer(); return;
  }
  if(t.hasAttribute('data-im-ligne')){ S.excl[+t.getAttribute('data-im-ligne')] = !!t.checked; var l = S.lignes.filter(function(x){ return x.n === +t.getAttribute('data-im-ligne'); })[0]; if(l) l.inclure = !!t.checked; ecran(); return; }
});
document.addEventListener('input', function(e){
  var t = e.target; if(!t || !t.hasAttribute || !S) return;
  if(t.hasAttribute('data-im-label')){ S.cols[+t.getAttribute('data-im-label')].label = t.value; }
  else if(t.hasAttribute('data-im-grpnom')){ var g = S.groupes[+t.getAttribute('data-im-grpnom')]; S.ov[g.cle] = Object.assign({}, S.ov[g.cle] || { mode:'nouveau', typeId:'' }, { nom:t.value }); g.nom = t.value; g.nomFinal = t.value; }
});
document.addEventListener('focusout', function(e){
  var t = e.target; if(S && t && t.hasAttribute && (t.hasAttribute('data-im-label') || t.hasAttribute('data-im-grpnom'))) recalculer();
});
document.addEventListener('dragover', function(e){ var d = e.target && e.target.closest ? e.target.closest('[data-im-depot]') : null; if(d){ e.preventDefault(); d.classList.add('sur'); } });
document.addEventListener('dragleave', function(e){ var d = e.target && e.target.closest ? e.target.closest('[data-im-depot]') : null; if(d) d.classList.remove('sur'); });
document.addEventListener('drop', function(e){
  var d = e.target && e.target.closest ? e.target.closest('[data-im-depot]') : null; if(!d) return;
  e.preventDefault(); d.classList.remove('sur');
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) chargerFichier(f);
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && S && !S.busy) fermer(); });

window.importParc = { ouvrir:ouvrir, fermer:fermer, lireXlsx:lireXlsx, lireCsv:lireCsv, dateDe:dateDe, nombreDe:nombreDe, sim:sim, etat:function(){ return S; } };
})();
