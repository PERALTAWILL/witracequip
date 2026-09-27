/* HORIZON — interface du seul super-administrateur plateforme.
   Les données et les autorisations continuent de venir de l'application ;
   tous les boutons renvoient aux routes et actions métier existantes. */

function identiteFondateur(){
return `<div class="hz-identity" aria-label="WiTracEQUIP · Espace Fondateur">
  <span class="hz-identity-mark" aria-hidden="true"><img src="assets/icons/logo-mark.png" alt=""></span>
  <span class="hz-identity-copy"><strong>WiTracEQUIP</strong><small>ESPACE FONDATEUR</small></span>
</div>`;
}

function boutonCommandesFondateur(clientId, flottant = false){
const titre = clientId ? 'Actions du client' : 'Applications & actions';
return `<button type="button" class="hz-command-trigger ${flottant ? 'hz-command-floating' : ''}" data-action="fondateur-commandes" ${clientId ? `data-id="${esc(clientId)}"` : ''} aria-haspopup="dialog" aria-expanded="false" aria-label="Ouvrir le tiroir ${esc(titre)}" title="${esc(titre)} · raccourci Ctrl/⌘ K">
  <span class="hz-launcher-mark" aria-hidden="true">✦</span><span class="hz-launcher-label">${clientId ? 'Actions du client' : 'Applications'}</span><span class="hz-launcher-shortcut" aria-hidden="true">Ctrl/⌘ K</span>${iconeNav('chevron',17)}
</button>`;
}

function chiffreFondateur(valeur){
return valeur === null || valeur === undefined
  ? '<span class="hz-number-pending" aria-label="Chargement"></span>'
  : Number.isFinite(Number(valeur)) ? Number(valeur).toLocaleString('fr-FR') : '—';
}

const JOURS_COURTS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
function dateCourteFondateur(){
const d = new Date();
const jj = String(d.getDate()).padStart(2,'0');
const mm = String(d.getMonth()+1).padStart(2,'0');
const aa = String(d.getFullYear()).slice(-2);
return `${JOURS_COURTS_FR[d.getDay()]} ${jj}/${mm}/${aa}`;
}

function renderTableauFondateur({ prenom = '', organisation = 'WiDIAG MQ', clients = null,
  profilsActifs = null, interventionsMois = null, aTraiter = null,
  clientsErreur = '', autresErreurs = false, horsLigne = false } = {}){
const liste = Array.isArray(clients) ? clients.filter(c => !c.est_mon_organisation) : null;
const heure = new Date().getHours();
const salut = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';
const probleme = !!(clientsErreur || autresErreurs);
return `
<div class="hz-dashboard">
  <section class="hz-hero" aria-labelledby="hz-title">
    <div class="hz-hero-copy">
      <div class="hz-hero-eyebrow">VOTRE ESPACE <span aria-hidden="true">✦</span> ${esc(organisation)}</div>
      <h1 id="hz-title">La vision.<br><em>La maîtrise.</em></h1>
      <p>${salut}${prenom ? ' ' + esc(prenom) : ''}, tout reste à portée.</p>
      ${horsLigne ? '<span class="hz-hero-offline">Hors connexion · dernier état connu</span>' : ''}
    </div>
    <div class="hz-hero-rings" aria-hidden="true"><i></i><i></i><i></i><span>W.</span></div>
  </section>

  ${probleme ? `<div class="alert alert-info hz-data-alert" role="status">Certaines données ne sont pas disponibles actuellement.
    <button type="button" data-action="fondateur-recharger">Réessayer ${iconeNav('undo', 15)}</button></div>` : ''}

  <section class="hz-priority hz-priority-support" aria-label="Support">
    <div class="hz-priority-kicker">
      <span>✦ &nbsp; VOTRE PRIORITÉ</span>
      <button type="button" class="hz-priority-launch" data-action="fondateur-commandes" aria-haspopup="dialog" aria-expanded="false" aria-label="Ouvrir votre espace de travail" title="Votre espace de travail">${iconeNav('grid',15)}</button>
    </div>
    <button type="button" class="hz-priority-focus" data-action="go" data-path="/reglages/support" aria-label="Ouvrir les demandes clients et demandes à traiter">
      <span class="hz-priority-focus-icon">${iconeNav('inbox',21)}</span>
      <span class="hz-priority-focus-text"><strong>${chiffreFondateur(aTraiter)}</strong><small>Demande${Number(aTraiter) > 1 ? 's' : ''} client${Number(aTraiter) > 1 ? 's' : ''} à traiter</small></span>
      <span class="hz-priority-focus-go" aria-hidden="true">${iconeNav('chevron',17)}</span>
    </button>
    <div class="hz-priority-date" role="status" aria-label="Date du jour">
      <span>${iconeNav('calendar',15)}</span><span>${esc(dateCourteFondateur())}</span>
    </div>
  </section>

  <div class="hz-section-heading"><span>EN UN REGARD</span><h2>Vue globale</h2></div>
  <div class="hz-figures" role="group" aria-label="Indicateurs du Fondateur">
    <button type="button" data-action="go" data-path="/reglages/clients"><strong>${chiffreFondateur(liste?.length)}</strong><span>Clients</span></button>
    <button type="button" data-action="go" data-path="/reglages/profils"><strong>${chiffreFondateur(profilsActifs)}</strong><span>Profils actifs</span></button>
    <button type="button" data-action="go" data-path="/reglages/support/rapports"><strong>${chiffreFondateur(interventionsMois)}</strong><span>Interventions / mois</span></button>
  </div>

  <div class="hz-section-heading"><span>ACCÈS DIRECT</span><h2>Avancer sans détour</h2></div>
  <div class="hz-shortcuts" aria-label="Applications et accès rapides">
    <button type="button" data-action="go" data-path="/reglages/clients"><span>${iconeNav('briefcase',20)}</span><strong>Portefeuille clients</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="go" data-path="/reglages/support"><span>${iconeNav('inbox',20)}</span><strong>Demandes de support</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="ouvrir-scanner"><span>${iconeNav('scan',20)}</span><strong>Scanner un QR code</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="go" data-path="/reglages/support/rapports"><span>${iconeNav('wrench',20)}</span><strong>Rapports d’intervention</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="go" data-path="/reglages/support/stats"><span>${iconeNav('chart',20)}</span><strong>Statistiques & export</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="go" data-path="/reglages/profils"><span>${iconeNav('users',20)}</span><strong>Profils & accès</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="go" data-path="/reglages/journal"><span>${iconeNav('journal',20)}</span><strong>Journal d’activité</strong>${iconeNav('chevron',16)}</button>
  </div>
  <button type="button" class="hz-scan-card" data-action="ouvrir-scanner" aria-label="Scanner un QR code pour ouvrir directement une fiche équipement">
    <span class="hz-scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i>${iconeNav('scan',24)}</span>
    <span class="hz-scan-copy"><strong>Scanner un équipement</strong><small>Ouvrez sa fiche en un geste, caméra directe</small></span>
    <span class="hz-scan-arrow" aria-hidden="true">${iconeNav('chevron',18)}</span>
  </button>
</div>`;
}

function ligneOutilFondateur(icone, titre, aide, path, action){
return `<button type="button" class="hz-tool-row" data-action="${action || 'go'}" ${path ? `data-path="${path}"` : ''}>
  <span class="hz-tool-icon">${iconeNav(icone,20)}</span><span><strong>${titre}</strong><small>${aide}</small></span>${iconeNav('chevron',16)}
</button>`;
}

function viewOutilsFondateur(){
return `<div class="hz-tools-page">
  <header class="hz-tools-hero"><span class="hz-overline">LA BIBLIOTHÈQUE DE DIRECTION</span><h1>Votre espace.<br><em>Sans limite.</em></h1><p>Chaque fonction à sa place, toujours accessible.</p><div class="hz-tool-orbit" aria-hidden="true"></div></header>
  <div class="hz-tools-grid hz-tools-grid-solo">
    <section class="hz-tools-group"><div class="hz-tools-label">ÉQUIPES & HISTORIQUE</div>
      ${ligneOutilFondateur('users', 'Profils & accès', 'Membres, rôles et appareils', '/reglages/profils')}
      ${ligneOutilFondateur('journal', 'Journal d’activité', 'Historique et traçabilité', '/reglages/journal')}
    </section>
  </div>
  <div class="hz-tools-scan">${ligneOutilFondateur('scan','Scanner un QR code','Ouvrir une fiche équipement',null,'ouvrir-scanner')}</div>
  <p class="hz-tools-note">Rapports, statistiques et modèles métier restent dans le menu déroulant de l’onglet Support.</p>
</div>`;
}

function renderEnteteClientFondateur(c, nbTypes, invites, enEdition){
const peutCreer = nbTypes > 0;
const enLigne = !state.horsLigne && navigator.onLine;
return `<div class="hz-client-header">
  <div class="hz-client-back"><button type="button" data-action="go" data-path="/reglages/clients" aria-label="Retour aux clients">${iconeNav('arrow-left',19)}</button><span>${esc(c.nom)}<small>CLIENT N° ${esc(c.code_client || '—')}</small></span></div>
  <section class="hz-client-banner" aria-label="Résumé du client">
    <div class="hz-client-kicker"><span>VOTRE CLIENT <b aria-hidden="true">✦</b> N° ${esc(c.code_client || '—')}</span><span class="hz-client-status ${c.active ? '' : 'suspended'}">${c.active ? 'ACTIF' : 'SUSPENDU'}</span></div>
    <h1>${esc(c.nom)}<span>.</span></h1>
    <p>${c.referent ? 'Référent · ' + esc(c.referent) : 'Dossier client'}${state.horsLigne || !navigator.onLine ? ' · Hors connexion' : ''}</p>
    <div class="hz-client-numbers"><span><strong>${chiffreFondateur(c.nb_equipements ?? 0)}</strong><small>Équipements</small></span><span><strong>${chiffreFondateur(c.nb_membres ?? 0)}</strong><small>Membres</small></span><span><strong>${invites === null ? chiffreFondateur(null) : chiffreFondateur(invites.length)}</strong><small>Invitations</small></span></div>
  </section>
  <nav class="hz-client-tabs" aria-label="Sections du client">
    ${[['fiche','Fiche'],['parc','Parc'],['equipe','Équipe'],['invitations','Invitations']].map(([id,label]) => `<button type="button" data-action="fondateur-section" data-section="${id}" ${id === 'parc' ? 'class="active" aria-current="true"' : ''}>${label}</button>`).join('')}
  </nav>
  <div class="hz-client-action-title"><span>ACTIONS PRIORITAIRES</span><small>Sans ouvrir de menu</small></div>
  <div class="hz-client-direct">
    <button type="button" data-action="nouvel-equip-client" data-id="${esc(c.id)}" ${peutCreer ? '' : 'disabled title="Ajoutez d’abord un type d’équipement"'}>${iconeNav('plus',18)} Nouvel équipement</button>
    <button type="button" data-action="fondateur-inviter-client" data-id="${esc(c.id)}" ${enLigne ? '' : 'disabled title="Connexion requise pour les invitations"'}>${iconeNav('send',18)} Inviter un membre</button>
  </div>
  <div class="hz-client-desktop-actions">
    ${!enEdition ? `<button type="button" class="btn btn-sm" data-action="modifier-client" data-id="${esc(c.id)}" ${enLigne ? '' : 'disabled'}>Modifier la fiche</button>` : ''}
    ${!c.est_mon_organisation ? `<button type="button" class="btn btn-sm" data-action="clients-statut" data-id="${esc(c.id)}" data-actif="${c.active ? '0' : '1'}" ${enLigne ? '' : 'disabled'}>${c.active ? 'Suspendre' : 'Réactiver'}</button>
    <button type="button" class="btn btn-sm btn-danger" data-action="clients-supprimer" data-id="${esc(c.id)}" ${enLigne ? '' : 'disabled'}>Supprimer</button>` : ''}
  </div>
</div>`;
}

function paletteFondateur(client){
const enLigne = !state.horsLigne && navigator.onLine;
const row = (icone, nom, aide, action, opts = '') => `<button type="button" class="hz-sheet-row" data-action="${action}" ${opts}>
  <span>${iconeNav(icone,19)}</span><span><strong>${nom}</strong><small>${aide}</small></span>${iconeNav('chevron',17)}</button>`;
const carte = (icone, nom, aide, action, opts = '') => `<button type="button" class="hz-drawer-card" data-action="${action}" ${opts}>
  <span class="hz-drawer-icon">${iconeNav(icone,18)}</span><span><strong>${nom}</strong><small>${aide}</small></span></button>`;
return `<div class="hz-sheet-handle" aria-hidden="true"></div>
  <div class="hz-sheet-head"><div><span>WiTracEQUIP <b aria-hidden="true">✦</b> ${esc(client ? `CLIENT · ${client.nom}` : 'ESPACE FONDATEUR')}</span>
    <h2 id="hz-sheet-title">${client ? 'Raccourcis client' : 'Votre espace de travail'}</h2><p>${client ? 'Les actions sont liées à cette organisation.' : 'Un tiroir unique pour vos outils de pilotage.'}</p></div>
    <button type="button" class="hz-sheet-close" data-action="fondateur-commandes-fermer" aria-label="Fermer le tiroir">✕</button></div>
  ${client ? `
    <div class="hz-sheet-label">GESTION DE L’ORGANISATION</div>
    ${row('tag','Gérer les types','Catégories d’équipement','go',`data-path="/types/${esc(client.id)}"`)}
    ${row('pencil','Modifier la fiche','Coordonnées et modèle métier','modifier-client',`data-id="${esc(client.id)}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}
    ${!client.est_mon_organisation ? `<div class="hz-sheet-label hz-sheet-label-safety">ACCÈS & SÉCURITÉ</div>
      ${row('archive', client.active ? 'Suspendre le client' : 'Réactiver le client','Confirmation et droits existants','clients-statut',`data-id="${esc(client.id)}" data-actif="${client.active ? '0' : '1'}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}
      ${row('trash','Supprimer définitivement','Confirmation par saisie obligatoire','clients-supprimer',`data-id="${esc(client.id)}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}` : ''}` : `
    <div class="hz-sheet-label">CRÉER & EXPLORER</div>
    <div class="hz-drawer-grid">
      ${carte('plus','Nouveau client','Créer une organisation','fondateur-nouveau-client',enLigne ? '' : 'disabled title="Connexion requise"')}
      ${carte('briefcase','Portefeuille clients','Rechercher et gérer les dossiers','go','data-path="/reglages/clients"')}
      ${carte('scan','Scanner un QR code','Accéder directement à une fiche','ouvrir-scanner')}
      ${carte('inbox','Demandes de support','À traiter et demandes archivées','go','data-path="/reglages/support"')}
    </div>
    <div class="hz-sheet-label hz-sheet-label-safety">ANALYSER & ADMINISTRER</div>
    <div class="hz-drawer-grid">
      ${carte('wrench','Rapports d’intervention','Rapports des parcs clients','go','data-path="/reglages/support/rapports"')}
      ${carte('chart','Statistiques & export','Mesures et exports de parc','go','data-path="/reglages/support/stats"')}
      ${carte('tag','Modèles métier','Préparer les secteurs clients','go','data-path="/reglages/support/modeles"')}
      ${carte('users','Profils & accès','Comptes, rôles et accès','go','data-path="/reglages/profils"')}
      ${carte('journal','Journal d’activité','Historique des opérations','go','data-path="/reglages/journal"')}
    </div>`}
  <p class="hz-sheet-foot">${enLigne ? 'Les raccourcis respectent les permissions et confirmations de l’application.' : 'Hors connexion : les fonctions d’administration sont indisponibles.'}</p>`;
}

/* <dialog> conserve le focus et rend l'arrière-plan inerte. La palette vit
   hors de #app : les mises à jour asynchrones ne ferment pas le menu et ne
   réinitialisent pas les formulaires. Aucune commande ne contourne les
   contrôles ou les confirmations de l'application. */
function ouvrirCommandesFondateur(clientId){
if(!isSuperAdmin() || !state.session) return;
const client = clientId ? (reglages.clients || []).find(c => c.id === clientId) : null;
if(clientId && !client) return;
fermerCommandesFondateur();
const dialogue = document.createElement('dialog');
dialogue.id = 'hz-sheet-dialog';
dialogue.className = 'hz-sheet-dialog';
dialogue.setAttribute('aria-labelledby','hz-sheet-title');
dialogue.innerHTML = paletteFondateur(client);
dialogue.addEventListener('close', () => {
if(!document.querySelector('.hz-sheet-dialog[open]')) document.querySelectorAll('[data-action="fondateur-commandes"]').forEach(b => b.setAttribute('aria-expanded','false'));
dialogue.remove();
}, { once:true });
dialogue.addEventListener('click', e => { if(e.target === dialogue) dialogue.close(); });
document.body.appendChild(dialogue);
dialogue.showModal();
document.querySelectorAll('[data-action="fondateur-commandes"]').forEach(b => b.setAttribute('aria-expanded','true'));
dialogue.querySelector('.hz-sheet-close')?.focus();
}

function fermerCommandesFondateur(){
const dialogue = document.getElementById('hz-sheet-dialog');
if(!dialogue) return;
if(dialogue.open) dialogue.close();
else dialogue.remove();
}

/* Les quatre repères font défiler les sections existantes au lieu de détruire
   et recréer les champs ; une invitation ou un formulaire en cours reste saisi. */
function allerSectionClientFondateur(section){
if(!isSuperAdmin() || !['fiche','parc','equipe','invitations'].includes(section)) return;
const cible = document.getElementById('hz-client-' + section);
if(!cible) return;
document.querySelectorAll('.hz-client-tabs [data-section]').forEach(btn => {
const active = btn.dataset.section === section;
btn.classList.toggle('active', active);
if(active) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
});
cible.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start' });
}

function inviterClientFondateur(id){
if(!isSuperAdmin() || state.route.sub !== id) return;
if(state.horsLigne || !navigator.onLine){ toast('Connexion requise pour inviter un membre.', 'info'); return; }
reglages.inviteOuvert = true;
render();
requestAnimationFrame(() => allerSectionClientFondateur('equipe'));
}