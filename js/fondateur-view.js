/* HORIZON — interface du seul super-administrateur plateforme.
   Les données et les autorisations continuent de venir de l'application ;
   tous les boutons renvoient aux routes et actions métier existantes. */

function identiteFondateur(){
return `<div class="hz-identity" aria-label="WiTracEQUIP · Espace Fondateur">
  <span class="hz-identity-mark" aria-hidden="true">W<small>✦</small></span>
  <span class="hz-identity-copy"><strong>WiTracEQUIP</strong><small>ESPACE FONDATEUR</small></span>
</div>`;
}

function boutonCommandesFondateur(clientId, flottant = false){
return `<button type="button" class="hz-command-trigger ${flottant ? 'hz-command-floating' : ''}" data-action="fondateur-commandes" ${clientId ? `data-id="${esc(clientId)}"` : ''} aria-haspopup="dialog">✦ &nbsp; ${clientId ? 'Autres actions' : 'Ouvrir les commandes'} ${iconeNav('chevron',18)}</button>`;
}

function chiffreFondateur(valeur){
return valeur === null || valeur === undefined
  ? '<span class="hz-number-pending" aria-label="Chargement"></span>'
  : Number.isFinite(Number(valeur)) ? Number(valeur).toLocaleString('fr-FR') : '—';
}

function renderTableauFondateur({ prenom = '', organisation = 'WiDIAG MQ', clients = null,
  profilsActifs = null, interventionsMois = null, aTraiter = null,
  clientsErreur = '', autresErreurs = false, horsLigne = false } = {}){
const liste = Array.isArray(clients) ? clients.filter(c => !c.est_mon_organisation) : null;
const recents = liste ? [...liste].sort((a,b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0,3) : [];
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

  <section class="hz-priority" aria-label="Demandes prioritaires du support">
    <div class="hz-priority-kicker"><span>✦ &nbsp; VOTRE PRIORITÉ</span><span class="hz-priority-dot" aria-hidden="true"></span></div>
    <div class="hz-priority-value"><strong>${chiffreFondateur(aTraiter)}</strong><div><b>Demandes clients</b><span>${aTraiter === 0 ? 'Tout est traité' : 'En attente de traitement'}</span></div></div>
    <button type="button" data-action="go" data-path="/reglages/support">Ouvrir le support ${iconeNav('chevron', 17)}</button>
  </section>

  <div class="hz-section-heading"><span>EN UN REGARD</span><h2>Vue globale</h2></div>
  <div class="hz-figures" role="group" aria-label="Indicateurs du Fondateur">
    <button type="button" data-action="go" data-path="/reglages/clients"><strong>${chiffreFondateur(liste?.length)}</strong><span>Clients</span></button>
    <button type="button" data-action="go" data-path="/reglages/profils"><strong>${chiffreFondateur(profilsActifs)}</strong><span>Profils actifs</span></button>
    <button type="button" data-action="go" data-path="/reglages/support/rapports"><strong>${chiffreFondateur(interventionsMois)}</strong><span>Interventions / mois</span></button>
  </div>

  <div class="hz-section-heading"><span>ACCÈS DIRECT</span><h2>Avancer sans détour</h2></div>
  <div class="hz-shortcuts">
    <button type="button" data-action="go" data-path="/reglages/clients"><span>${iconeNav('briefcase',18)}</span><strong>Portefeuille clients</strong>${iconeNav('chevron',16)}</button>
    <button type="button" data-action="ouvrir-scanner"><span>${iconeNav('scan',18)}</span><strong>Scanner un QR code</strong>${iconeNav('chevron',16)}</button>
  </div>
  ${clientsErreur ? '' : liste === null ? '<div class="hz-recent hz-recent-loading" aria-label="Clients en cours de chargement">Chargement des clients…</div>'
    : recents.length ? `<div class="hz-recent-list" aria-label="Clients récents">${recents.map(c => `
      <button type="button" class="hz-recent" data-action="go" data-path="/reglages/clients/${esc(c.id)}">
        <span class="hz-recent-avatar">${esc(initials(c.nom))}</span>
        <span><strong>${esc(c.nom)}</strong><small>N° ${esc(c.code_client || '—')} · ${chiffreFondateur(c.nb_equipements ?? 0)} équipements</small></span>
        ${iconeNav('chevron',15)}
      </button>`).join('')}</div>`
    : '<div class="hz-recent hz-recent-loading">Aucun client dans le portefeuille.</div>'}

  ${boutonCommandesFondateur()}
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
  <div class="hz-tools-grid">
    <section class="hz-tools-group"><div class="hz-tools-label">01 · ÉQUIPES & HISTORIQUE</div>
      ${ligneOutilFondateur('users', 'Profils & accès', 'Membres, rôles et appareils', '/reglages/profils')}
      ${ligneOutilFondateur('journal', 'Journal d’activité', 'Historique et traçabilité', '/reglages/journal')}
    </section>
    <section class="hz-tools-group"><div class="hz-tools-label">02 · ANALYSER & PRÉPARER</div>
      ${ligneOutilFondateur('wrench', 'Rapports d’intervention', 'Suivi des interventions', '/reglages/support/rapports')}
      ${ligneOutilFondateur('chart', 'Statistiques & export', 'Vue et export d’un parc', '/reglages/support/stats')}
      ${ligneOutilFondateur('tag', 'Modèles métier', 'Préparer les types du secteur', '/reglages/support/modeles')}
    </section>
  </div>
  <div class="hz-tools-scan">${ligneOutilFondateur('scan','Scanner un QR code','Ouvrir une fiche équipement',null,'ouvrir-scanner')}</div>
  ${boutonCommandesFondateur()}
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
return `<div class="hz-sheet-handle" aria-hidden="true"></div>
  <div class="hz-sheet-head"><div><span>VOTRE ${client ? 'CLIENT' : 'ESPACE'} <b aria-hidden="true">✦</b> ${esc(client ? `${client.nom} · N° ${client.code_client || '—'}` : 'FONDATEUR')}</span>
    <h2 id="hz-sheet-title">${client ? 'Plus d’actions.' : 'Vos commandes.'}</h2><p>${client ? 'Équipement et invitation sont directs sur la fiche.' : 'Les commandes essentielles, au même endroit.'}</p></div>
    <button type="button" class="hz-sheet-close" data-action="fondateur-commandes-fermer" aria-label="Fermer les commandes">✕</button></div>
  <div class="hz-sheet-label">${client ? 'GESTION DU DOSSIER' : 'ACTIONS COURANTES'}</div>
  ${client ? `
    ${row('tag','Gérer les types','Catégories d’équipement','go',`data-path="/types/${esc(client.id)}"`)}
    ${row('pencil','Modifier la fiche','Coordonnées et modèle métier','modifier-client',`data-id="${esc(client.id)}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}
    ${!client.est_mon_organisation ? `<div class="hz-sheet-label hz-sheet-label-safety">ACCÈS & SÉCURITÉ</div>
      ${row('archive', client.active ? 'Suspendre le client' : 'Réactiver le client','Confirmation et droits existants','clients-statut',`data-id="${esc(client.id)}" data-actif="${client.active ? '0' : '1'}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}
      ${row('trash','Supprimer définitivement','Confirmation par saisie obligatoire','clients-supprimer',`data-id="${esc(client.id)}" ${enLigne ? '' : 'disabled title="Connexion requise"'}`)}` : ''}` : `
    ${row('plus','Nouveau client','Créer une organisation','fondateur-nouveau-client',enLigne ? '' : 'disabled title="Connexion requise"')}
    ${row('briefcase','Portefeuille clients','Rechercher et gérer les dossiers','go','data-path="/reglages/clients"')}
    ${row('scan','Scanner un QR code','Ouvrir un équipement','ouvrir-scanner')}
    <div class="hz-sheet-label hz-sheet-label-safety">ÉQUIPES & HISTORIQUE</div>
    ${row('users','Profils & accès','Membres et rôles','go','data-path="/reglages/profils"')}
    ${row('journal','Journal d’activité','Suivi des opérations','go','data-path="/reglages/journal"')}`}
  <p class="hz-sheet-foot">${enLigne ? 'Les autorisations, confirmations et journaux restent inchangés.' : 'Hors connexion : administration indisponible ; lecture et scanner possibles.'}</p>`;
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
dialogue.addEventListener('close', () => dialogue.remove(), { once:true });
dialogue.addEventListener('click', e => { if(e.target === dialogue) dialogue.close(); });
document.body.appendChild(dialogue);
dialogue.showModal();
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
