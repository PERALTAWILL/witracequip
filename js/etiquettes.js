/* ======================================================================
   WiTracEQUIP - Impression groupée des QR codes
   ----------------------------------------------------------------------
   Depuis la liste des équipements : cocher les équipements (ou « Tout
   sélectionner »), puis « Imprimer les QR » : une étiquette 2 x 2 cm par QR, une par page.
   Le QR porte le petit « W » central, comme sur la fiche.
   Module additif : s'il échoue, le reste de l'application n'est pas touché.
   ====================================================================== */
(function(){
'use strict';

function h(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function styleImpression(){
  var s = document.getElementById('lot-print-style');
  if(!s){ s = document.createElement('style'); s.id = 'lot-print-style'; document.head.appendChild(s); }
  s.textContent =
'#print-lot{display:none;}' +
'@media print{' +
'@page{size:20mm 20mm;margin:1mm;}' +
'body.imp-lot > *:not(#print-lot){display:none !important;}' +
'html,body{background:#fff !important;margin:0;padding:0;}' +
'body.imp-lot #print-lot{display:block !important;width:18mm;color:#000;font-family:Arial,Helvetica,sans-serif;}' +
'#print-lot .lot-et{text-align:center;overflow:hidden;box-sizing:border-box;width:18mm;height:18mm;page-break-after:always;}' +
'#print-lot .lot-et:last-child{page-break-after:auto;}' +
'#print-lot .lot-et img{display:block;margin:0 auto;width:14mm;height:14mm;}' +
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

document.addEventListener('click', function(e){
  var t = e.target; if(t && t.closest && t.closest('[data-action="imprimer-qr-sel"]')) imprimer();
});

window.etiquettesLot = { imprimer:imprimer };
})();
