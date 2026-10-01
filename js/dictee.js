/* WiTracEQUIP - Dictee vocale : bouton micro sous les champs de texte long (API Web Speech du navigateur). */
(function(){
'use strict';
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if(!SR) return;

var actif = null; // { rec, ta, btn }

function langue(){
  var l = document.documentElement.lang || '';
  if(!l){ try{ l = localStorage.getItem('wte_lang') || ''; }catch(e){} }
  l = (l || 'fr').toLowerCase();
  return l.indexOf('en') === 0 ? 'en-US' : 'fr-FR';
}

function styles(){
  if(document.getElementById('dictee-css')) return;
  var s = document.createElement('style');
  s.id = 'dictee-css';
  s.textContent =
    '.dictee-btn{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0;padding:6px 12px;border-radius:999px;' +
    'border:1px solid var(--border,#ccc);background:var(--surface,#fff);color:var(--text,#222);font-size:12.5px;cursor:pointer}' +
    '.dictee-btn:hover{background:var(--surface-2,#f0f2f4)}' +
    '.dictee-btn.ecoute{background:var(--danger,#b3261e);border-color:var(--danger,#b3261e);color:#fff}' +
    '.dictee-btn.ecoute::before{content:"";width:8px;height:8px;border-radius:50%;background:#fff;animation:dictee-pulse 1s infinite}' +
    '@keyframes dictee-pulse{50%{opacity:.25}}';
  document.head.appendChild(s);
}

function libelle(ecoute){
  var en = langue() === 'en-US';
  return ecoute ? (en ? 'Stop' : 'Arrêter') : (en ? '🎤 Dictate' : '🎤 Dicter');
}

function arreter(){
  if(!actif) return;
  var a = actif; actif = null;
  try{ a.rec.stop(); }catch(e){}
  a.btn.classList.remove('ecoute');
  a.btn.textContent = libelle(false);
}

function demarrer(ta, btn){
  if(actif){ var memeChamp = actif.ta === ta; arreter(); if(memeChamp) return; }
  var rec = new SR();
  rec.lang = langue();
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = function(ev){
    if(!ta.isConnected){ arreter(); return; }
    var ajout = '';
    for(var i = ev.resultIndex; i < ev.results.length; i++){
      if(ev.results[i].isFinal) ajout += ev.results[i][0].transcript;
    }
    ajout = ajout.trim();
    if(!ajout) return;
    var sep = ta.value && !/[\s\n]$/.test(ta.value) ? ' ' : '';
    ta.value = ta.value + sep + ajout;
    ta.dispatchEvent(new Event('input', { bubbles:true }));
  };
  rec.onerror = function(ev){
    var refus = ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed');
    var reseau = ev && ev.error === 'network';
    if(typeof toast === 'function'){
      toast(refus ? 'Micro refusé : autorisez-le dans les réglages du navigateur.'
        : (reseau ? 'Pas de réseau : utilisez le micro du clavier de votre téléphone (dictée hors ligne).'
        : 'Dictée interrompue (micro).'), 'erreur');
    }
    arreter();
  };
  rec.onend = function(){ if(actif && actif.rec === rec) arreter(); };
  try{
    rec.start();
    actif = { rec:rec, ta:ta, btn:btn };
    btn.classList.add('ecoute');
    btn.textContent = libelle(true);
  }catch(e){ arreter(); }
}

function ajouter(ta){
  if(ta.dataset.dictee === '0' || ta.readOnly || ta.disabled) return;
  var suivant = ta.nextElementSibling;
  if(suivant && suivant.classList && suivant.classList.contains('dictee-btn')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dictee-btn';
  btn.setAttribute('data-no-i18n', '');
  btn.textContent = libelle(false);
  btn.addEventListener('click', function(){ demarrer(ta, btn); });
  ta.insertAdjacentElement('afterend', btn);
}

function balayer(){
  var zone = document.getElementById('app');
  if(!zone) return;
  var champs = zone.querySelectorAll('textarea');
  for(var i = 0; i < champs.length; i++) ajouter(champs[i]);
}

var attente = null;
function planifier(){
  if(attente) return;
  attente = setTimeout(function(){ attente = null; balayer(); }, 150);
}

styles();
new MutationObserver(planifier).observe(document.body, { childList:true, subtree:true });
document.addEventListener('visibilitychange', function(){ if(document.hidden) arreter(); });
planifier();
})();
