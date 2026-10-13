/* ======================================================================
   WiTracEQUIP - Impression groupée des QR codes
   ----------------------------------------------------------------------
   Depuis la liste des équipements : cocher les équipements (ou « Tout
   sélectionner »), puis « Imprimer les QR » : une étiquette par QR, une par page,
   au format défini dans ETIQUETTE (config.js : largeur_mm x hauteur_mm).
   Export : « Exporter l'étiquette » (fiche) = image PNG ; « Exporter les étiquettes »
   (sélection) = PDF, une étiquette par page. Pensé pour l'appli Phomemo en Bluetooth :
   on importe le fichier dans l'appli, qui l'envoie à l'imprimante.
   Le QR porte le petit « W » central, comme sur la fiche.
   Module additif : s'il échoue, le reste de l'application n'est pas touché.
   ====================================================================== */
(function(){
'use strict';

function h(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* Dimensions de l'étiquette (config.js), avec des valeurs de repli sûres. */
function dims(){
  var E = (typeof ETIQUETTE !== 'undefined' && ETIQUETTE) ? ETIQUETTE : {};
  var L = +E.largeur_mm || 40, H = +E.hauteur_mm || 30;
  var Q = Math.min(+E.taille_qr_mm || 22, L - 4, H - 8);
  return { L:L, H:H, Q:Q, site:(E.texte_site || '') };
}

function styleImpression(){
  var d = dims(), L = d.L, H = d.H, Q = d.Q;
  var s = document.getElementById('lot-print-style');
  if(!s){ s = document.createElement('style'); s.id = 'lot-print-style'; document.head.appendChild(s); }
  s.textContent =
'#print-lot{display:none;}' +
'@media print{' +
'@page{size:' + L + 'mm ' + H + 'mm;margin:1mm;}' +
'body.imp-lot > *:not(#print-lot){display:none !important;}' +
'html,body{background:#fff !important;margin:0;padding:0;}' +
'body.imp-lot #print-lot{display:block !important;width:' + (L - 2) + 'mm;color:#000;font-family:Arial,Helvetica,sans-serif;}' +
'#print-lot .lot-et{text-align:center;overflow:hidden;box-sizing:border-box;width:' + (L - 2) + 'mm;height:' + (H - 2) + 'mm;page-break-after:always;}' +
'#print-lot .lot-et:last-child{page-break-after:auto;}' +
'#print-lot .lot-et img{display:block;margin:0 auto;width:' + Q + 'mm;height:' + Q + 'mm;}' +
'#print-lot .lot-site{font-size:6pt;margin-top:0.6mm;white-space:nowrap;}' +
'}';
}

function qrImage(url){
  if(typeof QRious === 'undefined') return '';
  var c = document.createElement('canvas');
  new QRious({ element:c, value:url, size:600, background:'white', foreground:'#000000', level:'H' });
  var g = c.getContext('2d'), s = c.width, b = Math.round(s * 0.2), x = (s - b) / 2, r = b * 0.18;
  g.fillStyle = '#ffffff'; g.fillRect(x - 8, x - 8, b + 16, b + 16);
  g.fillStyle = '#000000'; g.beginPath(); g.moveTo(x + r, x); g.arcTo(x + b, x, x + b, x + b, r); g.arcTo(x + b, x + b, x, x + b, r); g.arcTo(x, x + b, x, x, r); g.arcTo(x, x, x + b, x, r); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'bold ' + Math.round(b * 0.74) + 'px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('W', s / 2, s / 2 + b * 0.04);
  return c.toDataURL('image/png');
}

function selection(){
  var ids = (typeof dashboardCache !== 'undefined' && dashboardCache.sel) ? dashboardCache.sel : [];
  var items = (typeof dashboardCache !== 'undefined' && dashboardCache.items) ? dashboardCache.items : [];
  return items.filter(function(e){ return ids.indexOf(e.id) >= 0 && e.public_token && !e.en_attente; });
}

function imprimer(){
  var liste = selection();
  if(!liste.length){ try{ toast('Cochez d’abord des équipements.', 'erreur'); }catch(e){} return; }
  var site = (typeof ETIQUETTE !== 'undefined' && ETIQUETTE.texte_site) ? ETIQUETTE.texte_site : '';
  var zone = document.getElementById('print-lot');
  if(!zone){ zone = document.createElement('div'); zone.id = 'print-lot'; document.body.appendChild(zone); }
  zone.innerHTML = liste.map(function(e){
    var url = (typeof lienPublic === 'function') ? lienPublic(e.public_token) : '';
    return '<div class="lot-et"><img alt="" src="' + qrImage(url) + '">' +
      (site ? '<div class="lot-site">' + h(site) + '</div>' : '') + '</div>';
  }).join('');
  styleImpression();
  var imgs = Array.prototype.slice.call(zone.querySelectorAll('img'));
  Promise.all(imgs.map(function(im){ return im.complete ? Promise.resolve() : new Promise(function(r){ im.onload = im.onerror = r; }); })).then(function(){
    document.body.classList.add('imp-lot');
    var fin = function(){ document.body.classList.remove('imp-lot'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  });
}

/* ---------------------------------------------------------------------
   Export de l'étiquette en image / PDF (pour l'appli Phomemo)
   --------------------------------------------------------------------- */
var DPI = 406; // 2 x 203 dpi (résolution des Phomemo) : l'appli réduit proprement par 2

function mm(v){ return Math.round(v * DPI / 25.4); }

/* Étiquette complète en canvas : fond blanc, QR (avec le « W ») centré,
   « WitracEquip.fr » en petit dessous. Noir et blanc purs, sans gris, pour
   une impression thermique nette. */
function dessinerEtiquette(url){
  var d = dims();
  var cv = document.createElement('canvas');
  cv.width = mm(d.L); cv.height = mm(d.H);
  var g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);

  var q = mm(d.Q);
  var texteH = d.site ? mm(3) : 0;
  var bloc = q + (d.site ? mm(1) + texteH : 0);
  var top = Math.max(mm(1), Math.round((cv.height - bloc) / 2));
  var img = new Image();
  return new Promise(function(ok){
    img.onload = img.onerror = function(){
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      try{ g.drawImage(img, Math.round((cv.width - q) / 2), top, q, q); }catch(e){}
      if(d.site){
        g.fillStyle = '#000000'; g.textAlign = 'center'; g.textBaseline = 'middle';
        var taille = mm(2.4);
        g.font = 'bold ' + taille + 'px Arial, Helvetica, sans-serif';
        while(g.measureText(d.site).width > cv.width - mm(2) && taille > 8){ taille -= 2; g.font = 'bold ' + taille + 'px Arial, Helvetica, sans-serif'; }
        g.fillText(d.site, cv.width / 2, top + q + mm(1) + texteH / 2);
      }
      // Noir et blanc purs (pas de gris qui se tramerait à l'impression)
      var im = g.getImageData(0, 0, cv.width, cv.height), p = im.data;
      for(var i = 0; i < p.length; i += 4){
        var v = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) < 150 ? 0 : 255;
        p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      ok(cv);
    };
    img.src = qrImage(url);
  });
}

function nomFichier(e){
  var base = (e && (e.serial_value || e.id)) ? String(e.serial_value || e.id) : 'equipement';
  base = base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'equipement';
  return 'etiquette-' + base;
}

function enregistrer(blob, nom){
  var a = document.createElement('a');
  var u = URL.createObjectURL(blob);
  a.href = u; a.download = nom; document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(u); }, 1500);
}

/* Sur téléphone : la feuille de partage permet d'ouvrir le fichier directement
   dans l'appli Phomemo. Sinon (ordinateur) : simple téléchargement. */
function livrer(blob, nom, type){
  var f = null;
  try{ f = new File([blob], nom, { type:type }); }catch(e){}
  if(f && navigator.canShare && navigator.canShare({ files:[f] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)){
    return navigator.share({ files:[f] }).catch(function(err){
      if(err && err.name === 'AbortError') return;
      enregistrer(blob, nom);
    });
  }
  enregistrer(blob, nom); return Promise.resolve();
}

function exporterUne(){
  var eq = (typeof equipDetail !== 'undefined' && equipDetail) ? equipDetail.item : null;
  if(!eq || !eq.public_token){ try{ toast('Aucune étiquette à exporter.', 'erreur'); }catch(e){} return; }
  if(typeof QRious === 'undefined'){ try{ toast('Générateur de QR indisponible : réessayez en ligne.', 'erreur'); }catch(e){} return; }
  var url = (typeof lienPublic === 'function') ? lienPublic(eq.public_token) : '';
  dessinerEtiquette(url).then(function(cv){
    cv.toBlob(function(b){
      if(!b){ try{ toast('Export impossible.', 'erreur'); }catch(e){} return; }
      livrer(b, nomFichier(eq) + '.png', 'image/png');
    }, 'image/png');
  });
}

function chargerJsPdf(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise(function(ok, ko){
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = function(){ (window.jspdf && window.jspdf.jsPDF) ? ok(window.jspdf.jsPDF) : ko(new Error('module PDF introuvable')); };
    s.onerror = function(){ ko(new Error('module PDF indisponible (hors ligne ?)')); };
    document.head.appendChild(s);
  });
}

/* Sélection de plusieurs équipements : un PDF, une étiquette par page. */
function exporterLot(){
  var liste = selection();
  if(!liste.length){ try{ toast('Cochez d’abord des équipements.', 'erreur'); }catch(e){} return; }
  if(typeof QRious === 'undefined'){ try{ toast('Générateur de QR indisponible : réessayez en ligne.', 'erreur'); }catch(e){} return; }
  var d = dims();
  chargerJsPdf().then(function(JsPDF){
    var pdf = new JsPDF({ orientation: d.L >= d.H ? 'landscape' : 'portrait', unit:'mm', format:[d.L, d.H], compress:true });
    var suite = Promise.resolve();
    liste.forEach(function(e, i){
      suite = suite.then(function(){
        var url = (typeof lienPublic === 'function') ? lienPublic(e.public_token) : '';
        return dessinerEtiquette(url).then(function(cv){
          if(i > 0) pdf.addPage([d.L, d.H], d.L >= d.H ? 'landscape' : 'portrait');
          pdf.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, d.L, d.H);
        });
      });
    });
    return suite.then(function(){
      livrer(pdf.output('blob'), 'etiquettes-' + liste.length + '-qr.pdf', 'application/pdf');
    });
  }).catch(function(err){ try{ toast('Export impossible : ' + err.message, 'erreur'); }catch(e){} });
}

document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest) return;
  if(t.closest('[data-action="imprimer-qr-sel"]')) imprimer();
  else if(t.closest('[data-action="exporter-etiquette"]')) exporterUne();
  else if(t.closest('[data-action="exporter-etiquettes-sel"]')) exporterLot();
});

window.etiquettesLot = { imprimer:imprimer, exporterUne:exporterUne, exporterLot:exporterLot, dessinerEtiquette:dessinerEtiquette };
})();
