/* ---------------------------------------------------------------------- */
/* Réglages — super-admin : Clients · Support · Journal                    */
/*            admin client : Mon équipe · Journal                          */
/* ---------------------------------------------------------------------- */
/* Le super-administrateur plateforme (WiDIAG MQ) gère ici tous ses clients :
   fiche entreprise, code client, modèle métier, puis les membres de chaque
   client. Un administrateur « client » n'y voit que sa propre organisation
   (onglets Membres, Invitations, Journal).
   Comme partout ailleurs, masquer un bouton n'est qu'un confort : les droits
   réels sont vérifiés par Supabase (RLS + fonctions SQL, voir sql/07). */

const MOTIFS_ARCHIVAGE = [
'Plus sur site', 'Obsolète', 'Vendu', 'Hors service / réformé', 'Volé / perdu', 'Restitué au loueur', 'Autre',
];

const CATEGORIES_SUPPORT = [
{ v:'question', l:'Question' },
{ v:'probleme', l:'Problème technique' },
{ v:'reclamation', l:'Réclamation' },
{ v:'evolution', l:"Demande d'évolution" },
];

const LIBELLES_JOURNAL = {
suppression_equipement: 'Équipement supprimé',
archivage_equipement: 'Équipement archivé',
restauration_equipement: 'Équipement restauré',
modification_intervention: 'Intervention modifiée',
suppression_intervention: 'Intervention supprimée',
suppression_membre: 'Membre supprimé',
suppression_client: 'Client supprimé',
suspension_client: 'Client suspendu',
reactivation_client: 'Client réactivé',
};

function isSuperAdmin(){ return state.superAdmin === true; }
function peutReglages(){ return isAdmin() || isSuperAdmin(); }
function nomModele(cle){ return (MODELES_METIERS.find(m => m.cle === cle) || {}).nom || ''; }

/* Peu d'onglets, chacun avec une seule mission. Les membres et les invitations
   d'un client se gèrent DANS sa fiche : plus d'onglet Membres ni Invitations
   séparés pour le super-admin (même contenu, deux chemins = on s'y perd). */
function ongletsReglages(){
const journal = { cle:'journal', l:'Journal', aide:"Historique des suppressions, archivages et modifications : qui, quand et pourquoi." };
if(isSuperAdmin()){
const aTraiter = (reglages.support || []).filter(d => d.statut !== 'traite').length;
return [
{ cle:'clients', l:'Clients', n: reglages.clients ? reglages.clients.length : null,
aide:"Ouvrez un client pour tout gérer au même endroit : sa fiche, son modèle métier, ses membres et ses invitations." },
{ cle:'support', l:'Support', n: aTraiter || null, alerte: aTraiter > 0,
aide:"Les demandes envoyées par vos clients. Une fois traitées, elles passent dans « Traitées »." },
journal,
];
}
return [
{ cle:'equipe', l:'Mon équipe', aide:"Les membres de votre organisation, leurs rôles et ce qu'ils peuvent voir." },
journal,
];
}

/* Anciennes adresses (#/reglages/membres, /invitations) → le bon onglet. */
function ongletReglagesValide(onglet){
if(['membres','invitations','equipe'].includes(onglet)) return isSuperAdmin() ? 'clients' : 'equipe';
return onglet;
}

/* Pied de page présent sur toutes les pages. */
function piedSupport(){
return `<div class="pied-support">Pour toute demande, contactez le support :
<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></div>`;
}

/* ---------------------------------------------------------------------- */
/* État                                                                    */
/* ---------------------------------------------------------------------- */

let reglages;
function resetReglages(){
reglages = {
clients:null, clientsLoading:false, clientsError:'', selClients:[],
clientForm:null,
membres:null, emails:{}, acces:null, typesOrgs:null, membresLoading:false, membresError:'',
selMembres:[], filtreClient:'',
invites:null,
invite:{ orgId:'', role:'utilisateur', label:'', tousTypes:true, types:[], busy:false, error:'', dernierToken:null },
journal:null, journalError:'',
support:null, supportError:'', supportFiltre:'ouvertes',
inviteOuvert:false,
};
}
resetReglages();

function chargerClients(force){
if(!isSuperAdmin() || reglages.clientsLoading) return;
if(reglages.clients !== null && !force) return;
reglages.clientsLoading = true;
listClients()
.then(c => { reglages.clients = c; reglages.clientsError = ''; })
.catch(e => { reglages.clientsError = e.message; })
.finally(() => { reglages.clientsLoading = false; render(); });
}

function chargerMembres(force){
if(reglages.membresLoading) return;
if(reglages.membres !== null && !force) return;
reglages.membresLoading = true;
Promise.all([listMembers(), listInvites(), listAcces(), listTypesToutesOrgs(), listEmailsMembres()])
.then(([m, i, a, t, em]) => {
reglages.membres = m; reglages.invites = i; reglages.acces = a; reglages.typesOrgs = t;
reglages.emails = Object.fromEntries(em.map(x => [x.id, x]));
reglages.membresError = '';
// La sélection ne garde que des membres encore présents.
reglages.selMembres = reglages.selMembres.filter(id => m.some(x => x.id === id));
})
.catch(e => { reglages.membresError = e.message; })
.finally(() => { reglages.membresLoading = false; render(); });
}

function rafraichirReglages(){
chargerMembres(true);
if(isSuperAdmin()) chargerClients(true);
}

/* ---------------------------------------------------------------------- */
/* Vue principale                                                          */
/* ---------------------------------------------------------------------- */

function viewReglages(onglet, sous){
if(!peutReglages()) return viewNonAutorise();
if(isSuperAdmin()){ chargerSupport(false); chargerClients(false); } // compteurs des onglets
onglet = ongletReglagesValide(onglet);
const onglets = ongletsReglages();
if(!onglets.some(o => o.cle === onglet)) onglet = onglets[0].cle;
const courant = onglets.find(o => o.cle === onglet);

let contenu = '';
if(onglet === 'clients') contenu = sous ? viewClientDetail(sous) : viewClients();
else if(onglet === 'equipe') contenu = viewMembres() + viewInvitations();
else if(onglet === 'support') contenu = viewSupportAdmin();
else if(onglet === 'journal') contenu = viewJournal();

return `
<div class="row between wrap" style="margin-bottom:10px;">
<h2>Réglages</h2>
${isSuperAdmin() ? '<span class="badge badge-role">Super-administrateur</span>' : `<span class="badge badge-role">${esc(state.orgName || '')}</span>`}
</div>
<div class="reglages-onglets">
${onglets.map(o => `<button class="reglages-onglet ${o.cle === onglet ? 'active' : ''}" data-action="go" data-path="/reglages/${o.cle}">${o.l}${o.n ? ` <span class="onglet-compteur ${o.alerte ? 'alerte' : ''}">${o.n}</span>` : ''}</button>`).join('')}
</div>
${!sous && courant?.aide ? `<div class="reglages-aide">${esc(courant.aide)}</div>` : ''}
${contenu}
`;
}

/* ---------------------------------------------------------------------- */
/* Onglet Clients (super-admin)                                            */
/* ---------------------------------------------------------------------- */

function viewClients(){
chargerClients(false);
chargerMembres(false); // pour compter les invitations en attente de chaque client
if(reglages.clientsError) return `<div class="alert alert-error">${esc(reglages.clientsError)}</div>`;
if(reglages.clients === null) return squeletteListe(4);

const clients = reglages.clients;
const selectionnables = clients.filter(c => !c.est_mon_organisation);
const sel = reglages.selClients;
const tousCoches = selectionnables.length > 0 && selectionnables.every(c => sel.includes(c.id));

const lignes = clients.map(c => `
<div class="ligne-select cliquable ${sel.includes(c.id) ? 'cochee' : ''}">
${c.est_mon_organisation
? `<span class="case-vide" title="Votre propre organisation"></span>`
: `<input type="checkbox" class="case-sel" data-action="sel-client" data-id="${c.id}" ${sel.includes(c.id) ? 'checked' : ''}>`}
<div class="ligne-corps" data-action="go" data-path="/reglages/clients/${c.id}">
<div class="ligne-titre">
${esc(c.nom)}
<span class="code-client">N° ${esc(c.code_client)}</span>
${c.est_mon_organisation ? '<span class="badge badge-neutral">votre organisation</span>' : ''}
${!c.active ? '<span class="badge badge-off">suspendu</span>' : ''}
</div>
<div class="small muted">
${c.modele_metier ? esc(nomModele(c.modele_metier)) : 'Aucun modèle métier'}
${c.referent ? ' · Référent : ' + esc(c.referent) : ''}
${c.telephone ? ' · ' + esc(c.telephone) : ''}
</div>
</div>
<div class="ligne-chiffres small muted">
<span class="compteur" title="Membres">${iconeNav('users', 14)} ${c.nb_membres}</span>
<span class="compteur" title="Équipements actifs">${iconeNav('box', 14)} ${c.nb_equipements}</span>
${(() => { const n = (reglages.invites || []).filter(i => i.organization_id === c.id).length;
return n ? `<span class="badge badge-warn" title="Invitation${n > 1 ? 's' : ''} en attente">${n} invit.</span>` : ''; })()}
</div>
</div>`).join('');

return `
${reglages.clientForm && !reglages.clientForm.id ? renderClientForm() : `
<div class="row between wrap" style="margin-bottom:12px;">
<div class="small muted">${clients.length} client${clients.length > 1 ? 's' : ''}</div>
<button class="btn btn-primary" data-action="nouveau-client">+ Nouveau client</button>
</div>`}

${sel.length ? `
<div class="barre-selection">
<strong>${sel.length} sélectionné${sel.length > 1 ? 's' : ''}</strong>
<button class="btn btn-sm" data-action="clients-statut" data-actif="0">Suspendre</button>
<button class="btn btn-sm" data-action="clients-statut" data-actif="1">Réactiver</button>
<button class="btn btn-sm btn-danger" data-action="clients-supprimer">Supprimer</button>
<button class="btn btn-sm btn-lien" data-action="clients-desel">Annuler</button>
</div>` : ''}

<div class="card liste-select">
${selectionnables.length ? `
<label class="tout-selectionner">
<input type="checkbox" data-action="sel-clients-tous" ${tousCoches ? 'checked' : ''}>
<span>Tout sélectionner</span>
</label>` : ''}
${lignes || `<div class="empty small">Aucun client.</div>`}
</div>
`;
}

function ouvrirClientForm(client){
reglages.clientForm = client
? { id:client.id, nom:client.nom || '', adresse:client.adresse || '', telephone:client.telephone || '',
email:client.email || '', referent:client.referent || '', notes:client.notes || '',
modele:client.modele_metier || '', busy:false, error:'' }
: { id:null, nom:'', adresse:'', telephone:'', email:'', referent:'', notes:'', modele:'', busy:false, error:'' };
render();
}

function renderClientForm(){
const f = reglages.clientForm;
const modif = !!f.id;
const modele = MODELES_METIERS.find(m => m.cle === f.modele);
return `
<form class="card" data-action="submit-client" style="margin-bottom:14px;">
<h3>${modif ? 'Modifier la fiche client' : 'Nouveau client'}</h3>
${f.error ? `<div class="alert alert-error">${esc(f.error)}</div>` : ''}
<div class="grid-2" style="margin-top:10px;">
<div class="field"><label>Nom de l'entreprise <span class="oblig">obligatoire</span></label>
<input type="text" name="nom" value="${esc(f.nom)}" placeholder="Ex : CHU Martinique" required></div>
<div class="field"><label>Référent</label>
<input type="text" name="referent" value="${esc(f.referent)}" placeholder="Nom de votre interlocuteur"></div>
<div class="field"><label>Téléphone</label>
<input type="text" name="telephone" value="${esc(f.telephone)}" placeholder="0596 …" inputmode="tel"></div>
<div class="field"><label>Email</label>
<input type="email" name="email" value="${esc(f.email)}" placeholder="contact@entreprise.fr"></div>
</div>
<div class="field"><label>Adresse</label>
<input type="text" name="adresse" value="${esc(f.adresse)}" placeholder="Rue, code postal, commune"></div>
<div class="field"><label>Modèle métier</label>
<select name="modele" data-action="client-modele">
<option value="">— Aucun pour l'instant —</option>
${MODELES_METIERS.map(m => `<option value="${m.cle}" ${m.cle === f.modele ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}
</select>
<div class="hint">${modele
? `Crée chez ce client : ${esc(modele.types.map(t => t.nom).join(', '))}. Les types déjà présents ne sont jamais dupliqués ni écrasés.`
: "Le modèle crée d'un coup les types d'équipement du secteur chez ce client. Tous ses membres en profiteront."}</div>
</div>
<div class="field"><label>Notes internes</label>
<textarea name="notes" placeholder="Conditions, contrat, remarques…">${esc(f.notes)}</textarea></div>
${!modif ? `<div class="hint" style="margin-bottom:10px;">Un <strong>numéro client</strong> unique à 6 chiffres est attribué automatiquement à l'enregistrement.</div>` : ''}
<div class="row wrap">
<button class="btn btn-primary" type="submit" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Enregistrement…' : (modif ? 'Enregistrer' : 'Créer le client')}</button>
<button class="btn" type="button" data-action="fermer-client-form">Annuler</button>
</div>
</form>`;
}

async function submitClientForm(form){
const f = reglages.clientForm;
if(!f) return;
const fd = new FormData(form);
for(const k of ['nom','adresse','telephone','email','referent','notes','modele']) f[k] = (fd.get(k) || '').toString();
if(!f.nom.trim()){ f.error = "Le nom de l'entreprise est obligatoire."; render(); return; }
f.busy = true; f.error = ''; render();
try{
if(f.id){
await modifierClient(f.id, f);
reglages.clientForm = null;
await chargerClientsMaintenant();
toast('Fiche client enregistrée');
} else {
const res = await creerClient(f);
reglages.clientForm = null;
await chargerClientsMaintenant();
toast(`Client créé — n° ${res.code_client}`);
nav('/reglages/clients/' + res.id);
return;
}
render();
}catch(e){
f.busy = false; f.error = e.message; render();
}
}

async function chargerClientsMaintenant(){
reglages.clients = await listClients();
}

function viewClientDetail(id){
chargerClients(false);
chargerMembres(false);
if(reglages.clientsError) return `<div class="alert alert-error">${esc(reglages.clientsError)}</div>`;
if(reglages.clients === null) return squeletteFiche('', '/reglages/clients');
const c = reglages.clients.find(x => x.id === id);
if(!c) return `<div class="alert alert-error">Client introuvable.</div>
<button class="btn" data-action="go" data-path="/reglages/clients">← Retour aux clients</button>`;

const enEdition = reglages.clientForm && reglages.clientForm.id === c.id;
const membres = (reglages.membres || []).filter(m => m.organization_id === c.id);
const invites = (reglages.invites || []).filter(i => i.organization_id === c.id);
// Formulaire d'invitation pré-réglé sur ce client.
if(reglages.invite.orgId !== c.id){
reglages.invite = { orgId:c.id, role:'utilisateur', label:'', tousTypes:true, types:[], busy:false, error:'', dernierToken:null };
}

return `
<div class="fiche-entete">
<button class="icon-btn" data-action="go" data-path="/reglages/clients" title="Retour">←</button>
<div class="titre">
<h2>${esc(c.nom)} ${!c.active ? '<span class="badge badge-off">suspendu</span>' : ''}</h2>
<div class="small muted">N° client <span class="code-client">${esc(c.code_client)}</span> · créé le ${fmtDate(c.created_at)}</div>
</div>
<div class="actions">
${!enEdition ? `<button class="btn btn-sm" data-action="modifier-client" data-id="${c.id}">Modifier</button>` : ''}
${!c.est_mon_organisation ? `
<button class="btn btn-sm" data-action="clients-statut" data-id="${c.id}" data-actif="${c.active ? '0' : '1'}">${c.active ? 'Suspendre' : 'Réactiver'}</button>
<button class="btn btn-sm btn-danger" data-action="clients-supprimer" data-id="${c.id}">Supprimer</button>` : ''}
</div>
</div>

${enEdition ? renderClientForm() : `
<div class="grid-2" style="align-items:start;">
<div class="card">
<h3 class="titre-carte">Fiche entreprise</h3>
<table>
<tr><td class="muted">Référent</td><td>${esc(c.referent || '—')}</td></tr>
<tr><td class="muted">Téléphone</td><td>${c.telephone ? `<a href="tel:${esc(c.telephone.replace(/\s+/g,''))}">${esc(c.telephone)}</a>` : '—'}</td></tr>
<tr><td class="muted">Email</td><td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</td></tr>
<tr><td class="muted">Adresse</td><td>${esc(c.adresse || '—')}</td></tr>
${c.notes ? `<tr><td class="muted">Notes</td><td>${esc(c.notes)}</td></tr>` : ''}
</table>
</div>
<div class="card">
<h3 class="titre-carte">Modèle métier</h3>
<div style="font-weight:650;margin:6px 0 2px;">${c.modele_metier ? esc(nomModele(c.modele_metier)) : 'Aucun modèle attribué'}</div>
<div class="small muted">${c.nb_types} type${c.nb_types > 1 ? 's' : ''} d'équipement · ${c.nb_equipements} équipement${c.nb_equipements > 1 ? 's' : ''} actif${c.nb_equipements > 1 ? 's' : ''} · ${c.nb_membres} membre${c.nb_membres > 1 ? 's' : ''}</div>
<div class="hint">Pour changer ou compléter le modèle, cliquez sur « Modifier ».</div>
</div>
</div>`}

<div class="card">
<div class="row between wrap">
<h3>Membres (${membres.length})</h3>
<button class="btn btn-sm ${reglages.inviteOuvert ? '' : 'btn-primary'}" data-action="toggle-invite-client">${reglages.inviteOuvert ? 'Fermer' : '+ Inviter un membre'}</button>
</div>
${reglages.inviteOuvert ? `
<div class="bloc-invite">
<div class="hint" style="margin-bottom:10px;">Générez un lien d'invitation : la personne rejoint <strong>${esc(c.nom)}</strong> avec le rôle et les accès choisis.</div>
${renderInviteForm(false)}
</div>` : ''}
${reglages.membres === null ? '<div class="spinner"></div>' : renderListeMembres(membres, false)}
</div>

${invites.length ? `
<div class="card">
<h3>Invitations en attente (${invites.length})</h3>
${invites.map(i => renderInvite(i, false)).join('')}
</div>` : ''}
`;
}

async function actionClientsStatut(ids, actif){
const clients = (reglages.clients || []).filter(c => ids.includes(c.id));
const noms = clients.map(c => c.nom).join(', ');
const msg = actif
? `Réactiver ${ids.length > 1 ? 'ces ' + ids.length + ' clients' : 'ce client'} ?\n\n${noms}\n\nTous leurs membres retrouvent l'accès.`
: `Suspendre ${ids.length > 1 ? 'ces ' + ids.length + ' clients' : 'ce client'} ?\n\n${noms}\n\nTous leurs membres perdent immédiatement l'accès. Rien n'est effacé.`;
if(!await confirmer(msg)) return;
try{
await definirStatutClients(ids, actif);
reglages.selClients = [];
toast(actif ? 'Accès rétabli' : 'Client suspendu — accès coupé');
rafraichirReglages();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

async function actionClientsSupprimer(ids){
const clients = (reglages.clients || []).filter(c => ids.includes(c.id));
if(!clients.length) return;
const noms = clients.map(c => `• ${c.nom} (n° ${c.code_client})`).join('\n');
const saisie = await demander(
`SUPPRESSION DÉFINITIVE de ${clients.length > 1 ? clients.length + ' clients' : 'ce client'} :\n\n${noms}\n\n` +
`Seront effacés : tous ses comptes, tous ses équipements et tout leur historique d'interventions. ` +
`Une trace est conservée dans le journal.\n\nPour une coupure temporaire, préférez « Suspendre ».\n\n` +
`Tapez SUPPRIMER pour confirmer :`, { danger:true, ok:'Supprimer définitivement', placeholder:'SUPPRIMER' });
if(saisie === null) return;
if(saisie.trim().toUpperCase() !== 'SUPPRIMER'){ toast('Suppression annulée : confirmation incorrecte.', 'info'); return; }
try{
await supprimerClients(clients.map(c => c.id));
reglages.selClients = [];
toast(clients.length > 1 ? clients.length + ' clients supprimés' : 'Client supprimé');
rafraichirReglages();
if(state.route.name === 'reglages' && state.route.sub) nav('/reglages/clients');
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* ---------------------------------------------------------------------- */
/* Onglet Membres                                                          */
/* ---------------------------------------------------------------------- */

function membreVerrouille(m){
// Soi-même : jamais. Le fondateur d'une organisation : seul le super-admin y touche.
return m.id === state.profile?.id || (m.fondateur && !isSuperAdmin());
}

function viewMembres(){
chargerMembres(false);
if(isSuperAdmin()) chargerClients(false);
if(reglages.membresError) return `<div class="alert alert-error">${esc(reglages.membresError)}</div>`;
if(reglages.membres === null) return squeletteListe(4);

let membres = reglages.membres;
const filtre = reglages.filtreClient;
if(isSuperAdmin() && filtre) membres = membres.filter(m => m.organization_id === filtre);

const clientsOptions = isSuperAdmin() ? (reglages.clients || []) : [];

return `
${isSuperAdmin() ? `
<div class="card" style="margin-bottom:12px;padding:12px 14px;">
<div class="row wrap" style="gap:10px;">
<label style="margin:0;">Client</label>
<select data-action="filtre-client-membres" style="flex:1;min-width:180px;">
<option value="">Tous les clients</option>
${clientsOptions.map(c => `<option value="${c.id}" ${c.id === filtre ? 'selected' : ''}>${esc(c.nom)} — n° ${esc(c.code_client)}</option>`).join('')}
</select>
</div>
</div>` : ''}
<div class="card">
<h3>Membres (${membres.length})</h3>
${renderListeMembres(membres, isSuperAdmin() && !filtre)}
</div>
`;
}

/* Liste de membres avec sélection multiple.
   avecClient : affiche le nom du client sous chaque membre (vue « tous les clients »). */
function renderListeMembres(membres, avecClient){
const selectionnables = membres.filter(m => !membreVerrouille(m));
const sel = reglages.selMembres.filter(id => membres.some(m => m.id === id));
const tousCoches = selectionnables.length > 0 && selectionnables.every(m => sel.includes(m.id));

return `
${sel.length ? `
<div class="barre-selection">
<strong>${sel.length} sélectionné${sel.length > 1 ? 's' : ''}</strong>
<button class="btn btn-sm" data-action="membres-active" data-active="0">Suspendre</button>
<button class="btn btn-sm" data-action="membres-active" data-active="1">Réactiver</button>
<button class="btn btn-sm btn-danger" data-action="membres-supprimer">Supprimer</button>
<button class="btn btn-sm btn-lien" data-action="membres-desel">Annuler</button>
</div>` : ''}
${selectionnables.length ? `
<label class="tout-selectionner">
<input type="checkbox" data-action="sel-membres-tous" data-ids="${selectionnables.map(m => m.id).join(',')}" ${tousCoches ? 'checked' : ''}>
<span>Tout sélectionner</span>
</label>` : ''}
${membres.length ? membres.map(m => renderMembre(m, avecClient)).join('') : `<div class="empty small">Aucun membre pour l'instant.</div>`}
`;
}

function renderMembre(m, avecClient){
const estMoi = m.id === state.profile?.id;
const estAdmin = m.role === 'admin';
const verrouille = membreVerrouille(m);
const coche = reglages.selMembres.includes(m.id);
const typesOrg = (reglages.typesOrgs || []).filter(t => t.organization_id === m.organization_id);
const acces = reglages.acces || [];
const email = reglages.emails[m.id]?.email || '';

const blocAcces = estAdmin ? '' : `
<div class="acces">
<label class="case">
<input type="checkbox" data-action="acces-tous" data-id="${m.id}" ${m.acces_tous_types ? 'checked' : ''} ${verrouille ? 'disabled' : ''}>
<span><strong>Tous les types d'équipement</strong></span>
</label>
${m.acces_tous_types
? `<div class="small muted" style="margin-left:24px;">Ce profil voit l'ensemble du parc.</div>`
: (typesOrg.length
? `<div class="acces-liste">
${typesOrg.map(t => `
<label class="case">
<input type="checkbox" data-action="acces-type" data-id="${m.id}" data-type="${t.id}"
${acces.some(a => a.profile_id === m.id && a.type_id === t.id) ? 'checked' : ''} ${verrouille ? 'disabled' : ''}>
<span>${esc(t.nom)}</span>
</label>`).join('')}
</div>`
: `<div class="small muted" style="margin-left:24px;">Aucun type d'équipement chez ce client.</div>`)}
</div>`;

return `
<div class="member ${coche ? 'cochee' : ''}">
${verrouille
? `<span class="case-vide"></span>`
: `<input type="checkbox" class="case-sel" data-action="sel-membre" data-id="${m.id}" ${coche ? 'checked' : ''}>`}
<div class="thumb">${esc(initials(m.full_name))}</div>
<div class="who">
<div style="font-weight:650;">
${esc(m.full_name || 'Sans nom')}
${estMoi ? '<span class="small muted">(vous)</span>' : ''}
${m.fondateur ? '<span class="badge badge-neutral">fondateur</span>' : ''}
${!m.active ? '<span class="badge badge-off">suspendu</span>' : ''}
</div>
<div class="small muted">
${email ? esc(email) + ' · ' : ''}membre depuis le ${fmtDate(m.created_at)}
${avecClient && m.organizations ? ` · <a href="#/reglages/clients/${m.organization_id}">${esc(m.organizations.nom)}</a>` : ''}
</div>
</div>
${verrouille
? `<span class="badge badge-role">${esc(roleLabel(m.role))}</span>`
: `<select data-action="member-role" data-id="${m.id}">
${ROLES_ASSIGNABLES.map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}
</select>`}
${blocAcces}
</div>`;
}

async function actionMembresActive(ids, active){
const msg = active
? `Réactiver ${ids.length} profil${ids.length > 1 ? 's' : ''} ? ${ids.length > 1 ? 'Ils retrouveront' : 'La personne retrouvera'} l'accès à l'application.`
: `Suspendre ${ids.length} profil${ids.length > 1 ? 's' : ''} ? Perte immédiate de l'accès, sans rien supprimer.`;
if(!await confirmer(msg)) return;
try{
await setMembresActive(ids, active);
reglages.selMembres = [];
toast(active ? 'Profil(s) réactivé(s)' : 'Profil(s) suspendu(s)');
rafraichirReglages();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); rafraichirReglages(); }
}

async function actionMembresSupprimer(ids){
const noms = (reglages.membres || []).filter(m => ids.includes(m.id)).map(m => '• ' + (m.full_name || 'Sans nom')).join('\n');
if(!await confirmer(
`Supprimer définitivement ${ids.length > 1 ? 'ces ' + ids.length + ' profils' : 'ce profil'} ?\n\n${noms}\n\n` +
`• Les comptes de connexion sont effacés\n• Les interventions qu'ils ont enregistrées sont CONSERVÉES\n` +
`• Une trace est gardée dans le journal\n\nIrréversible. Pour un départ temporaire, préférez « Suspendre ».`)) return;
try{
await supprimerProfils(ids);
reglages.selMembres = [];
toast(ids.length > 1 ? ids.length + ' profils supprimés' : 'Profil supprimé');
rafraichirReglages();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); rafraichirReglages(); }
}

async function actionRoleMembre(id, role){
if(role === 'admin' && !await confirmer(
"Promouvoir ce profil ADMINISTRATEUR de son organisation ?\n\n" +
"Il pourra gérer tout le parc de son organisation, en modifier les membres " +
"et supprimer définitivement équipements et interventions.")){
rafraichirReglages(); return;
}
try{ await setMemberRole(id, role); toast('Rôle mis à jour : ' + roleLabel(role)); }catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
rafraichirReglages();
}

async function actionAccesTous(id, valeur){
try{ await setAccesTousTypes(id, valeur); }catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
rafraichirReglages();
}

async function actionAccesType(profileId, typeId, autoriser){
try{ await setAccesType(profileId, typeId, autoriser); }catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
rafraichirReglages();
}

/* ---------------------------------------------------------------------- */
/* Onglet Invitations : créer + en attente, sur une même page              */
/* ---------------------------------------------------------------------- */

/* Qui peut générer un lien : le super-admin (pour tous ses clients) ou le
   fondateur d'une organisation (pour la sienne). Vérifié aussi par la base. */
function peutInviter(){ return isSuperAdmin() || !!state.profile?.fondateur; }

function viewInvitations(){
chargerMembres(false);
if(isSuperAdmin()) chargerClients(false);
if(reglages.membresError) return `<div class="alert alert-error">${esc(reglages.membresError)}</div>`;
if(reglages.membres === null) return squeletteListe(4);

const invites = reglages.invites || [];
return `
<div class="card">
<h3>Ajouter quelqu'un</h3>
${peutInviter() ? `
<div class="hint" style="margin-bottom:12px;">
Vous fixez le client, le rôle <strong>et</strong> le périmètre avant d'envoyer le lien.
La personne rejoint l'organisation avec exactement ces droits, sans pouvoir les modifier.
</div>
${renderInviteForm(isSuperAdmin())}` : `
<div class="alert alert-info" style="margin:8px 0 0;">
L'ajout de nouveaux utilisateurs est géré par WiDIAG MQ. Écrivez à
<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> ou passez par la page Support.
</div>`}
</div>

<div class="card">
<h3>Invitations en attente (${invites.length})</h3>
${invites.length ? invites.map(i => renderInvite(i, isSuperAdmin())).join('') : `<div class="empty small">Aucune invitation en attente.</div>`}
</div>
`;
}

function renderInviteForm(choixClient){
const inv = reglages.invite;
if(!choixClient && !inv.orgId) inv.orgId = state.profile.organization_id;
const clients = reglages.clients || [];
const typesOrg = inv.orgId ? (reglages.typesOrgs || []).filter(t => t.organization_id === inv.orgId) : [];

return `
${inv.error ? `<div class="alert alert-error">${esc(inv.error)}</div>` : ''}
${choixClient ? `
<div class="field">
<label>Client</label>
<select data-action="invite-org">
<option value="">— Choisir un client —</option>
${clients.filter(c => c.active).map(c => `<option value="${c.id}" ${c.id === inv.orgId ? 'selected' : ''}>${esc(c.nom)} — n° ${esc(c.code_client)}</option>`).join('')}
</select>
</div>` : ''}
<div class="grid-2">
<div class="field">
<label>Rôle</label>
<select data-action="invite-role">
${ROLES_ASSIGNABLES.map(r => `<option value="${r}" ${r === inv.role ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}
</select>
<div class="hint">${esc(ROLE_RESUME[inv.role] || '')}</div>
</div>
<div class="field">
<label>Nom de la personne (facultatif)</label>
<input type="text" placeholder="Ex : Marc Dupont" value="${esc(inv.label)}" data-action="invite-label">
</div>
</div>
${inv.role === 'admin' ? `
<div class="alert alert-warn-admin">
<strong>Administrateur de son organisation :</strong> il gérera tout le parc de ce client, pourra modifier
ses membres et supprimer définitivement équipements et interventions. Il voit tous les métiers.
</div>` : `
<label>Périmètre métier</label>
<div class="acces" style="margin-bottom:12px;">
<label class="case">
<input type="checkbox" data-action="invite-tous-types" ${inv.tousTypes ? 'checked' : ''}>
<span><strong>Tous les types d'équipement</strong></span>
</label>
${inv.tousTypes
? `<div class="small muted" style="margin-left:24px;">Cette personne verra l'ensemble du parc.</div>`
: (typesOrg.length
? `<div class="acces-liste">
${typesOrg.map(t => `
<label class="case">
<input type="checkbox" data-action="invite-type" data-type="${t.id}" ${inv.types.includes(t.id) ? 'checked' : ''}>
<span>${esc(t.nom)}</span>
</label>`).join('')}
</div>`
: `<div class="small muted" style="margin-left:24px;">${inv.orgId ? "Aucun type d'équipement chez ce client : attribuez-lui d'abord un modèle métier." : "Choisissez d'abord un client."}</div>`)}
</div>`}
<button class="btn btn-primary" data-action="creer-invite" ${inv.busy ? 'disabled' : ''}>${inv.busy ? 'Création…' : 'Générer le lien'}</button>
${inv.dernierToken ? `
<div class="alert alert-success" style="margin:14px 0 0;">
Lien créé — transmettez-le à la personne concernée (valable 14 jours).
${renderLienInvite(inv.dernierToken, inv.derniereOrgNom || '')}
</div>` : ''}
`;
}

function renderLienInvite(token, orgNom){
const lien = inviteUrl(token);
const sujet = encodeURIComponent('Votre accès WiTracEQUIP' + (orgNom ? ' — ' + orgNom : ''));
const corps = encodeURIComponent(
`Bonjour,\n\nVoici votre lien personnel pour créer votre compte WiTracEQUIP${orgNom ? ' (' + orgNom + ')' : ''} :\n${lien}\n\n` +
`Ce lien est valable 14 jours et ne peut servir qu'une fois.\n\nCordialement,\nWiDIAG MQ`);
return `
<div class="invite-link">
<code>${esc(lien)}</code>
<button class="btn btn-sm" data-action="copier-lien" data-token="${esc(token)}">Copier</button>
<a class="btn btn-sm" href="mailto:?subject=${sujet}&body=${corps}">Envoyer par mail</a>
</div>`;
}

function renderInvite(i, avecClient){
const typesOrg = (reglages.typesOrgs || []).filter(t => t.organization_id === i.organization_id);
const orgNom = i.organizations?.nom || '';
return `
<div class="member">
<div class="who">
<div style="font-weight:650;">
${esc(i.label || 'Invitation')}
<span class="badge badge-role">${esc(roleLabel(i.role))}</span>
</div>
<div class="small muted">
${avecClient ? (orgNom ? `<a href="#/reglages/clients/${i.organization_id}">${esc(orgNom)}</a> · ` : 'Nouvelle organisation · ') : ''}
${i.role === 'admin' || i.acces_tous_types
? 'Tous les types'
: 'Accès : ' + esc(typesOrg.filter(t => (i.types_autorises || []).includes(t.id)).map(t => t.nom).join(', ') || 'aucun type')}
· valable jusqu'au ${fmtDate(i.expires_at)}
</div>
${renderLienInvite(i.token, orgNom)}
</div>
<button class="btn btn-sm btn-danger" data-action="annuler-invite" data-id="${i.id}">Annuler</button>
</div>`;
}

async function actionCreerInvite(){
const inv = reglages.invite;
if(!inv.orgId){ inv.error = 'Choisissez le client pour lequel créer ce lien.'; render(); return; }
const estAdmin = inv.role === 'admin';
if(estAdmin){ inv.tousTypes = true; inv.types = []; }
if(!inv.tousTypes && inv.types.length === 0){
inv.error = "Choisissez au moins un type d'équipement, sinon cette personne n'aurait accès à rien.";
render(); return;
}
const orgNom = (reglages.clients || []).find(c => c.id === inv.orgId)?.nom
|| (inv.orgId === state.profile.organization_id ? state.orgName : '');
if(estAdmin && !await confirmer(`Créer un lien d'invitation ADMINISTRATEUR pour ${orgNom || 'ce client'} ?`)) return;

inv.error = ''; inv.busy = true; render();
try{
const created = await createInvite(inv.orgId, inv.role, inv.label.trim(), inv.tousTypes, inv.types);
inv.dernierToken = created.token;
toast("Lien d'invitation créé");
inv.derniereOrgNom = orgNom;
inv.label = '';
reglages.invites = await listInvites();
}catch(e){
inv.error = e.message;
}finally{
inv.busy = false; render();
}
}

async function actionAnnulerInvite(id){
if(!await confirmer("Annuler cette invitation ? Le lien ne fonctionnera plus.")) return;
try{
await cancelInvite(id);
reglages.invites = await listInvites();
toast('Invitation annulée');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* ---------------------------------------------------------------------- */
/* Onglet Journal                                                          */
/* ---------------------------------------------------------------------- */

function viewJournal(){
if(reglages.journal === null && !reglages.journalLoading){
reglages.journalLoading = true;
listJournal()
.then(j => { reglages.journal = j; reglages.journalError = ''; })
.catch(e => { reglages.journalError = e.message; })
.finally(() => { reglages.journalLoading = false; render(); });
}
if(reglages.journalError) return `<div class="alert alert-error">${esc(reglages.journalError)}</div>`;
if(reglages.journal === null) return squeletteListe(5);

const lignes = reglages.journal.map(j => {
let detail = '';
if(j.action === 'modification_intervention' && j.donnees?.avant){
const a = j.donnees.avant, p = j.donnees.apres || {};
const diff = ['date','type','technicien','description']
.filter(k => (a[k] ?? '') !== (p[k] ?? ''))
.map(k => `<div><span class="muted">${esc(k)} :</span> <s>${esc(k === 'date' ? fmtDate(a[k]) : (a[k] || '—'))}</s> → ${esc(k === 'date' ? fmtDate(p[k]) : (p[k] || '—'))}</div>`).join('');
detail = diff || '<div class="muted">Aucun changement visible.</div>';
} else if(j.action === 'suppression_equipement' && j.donnees?.interventions){
detail = `<div class="muted">${j.donnees.interventions.length} intervention(s) effacée(s) avec l'équipement.</div>`;
}
return `
<div class="journal-ligne">
<div class="journal-date">${fmtDateTime(j.le)}</div>
<div class="journal-corps">
<div><strong>${esc(LIBELLES_JOURNAL[j.action] || j.action)}</strong> — ${esc(j.libelle || '')}</div>
<div class="small muted">
par ${esc(j.par_nom || '—')}${isSuperAdmin() && j.organisation_nom ? ' · ' + esc(j.organisation_nom) : ''}
</div>
${j.motif ? `<div class="small">Motif : ${esc(j.motif)}</div>` : ''}
${detail ? `<details class="small"><summary>Détails</summary>${detail}</details>` : ''}
</div>
</div>`;
}).join('');

return `
<div class="card">
<div class="row between wrap">
<h3>Journal des suppressions et modifications</h3>
<button class="btn btn-sm" data-action="journal-rafraichir">Actualiser</button>
</div>
<div class="hint" style="margin-bottom:8px;">Chaque suppression, archivage ou modification d'intervention est tracé ici : qui, quand, pourquoi.</div>
${lignes || `<div class="empty small">Rien à signaler pour l'instant.</div>`}
</div>`;
}

/* ---------------------------------------------------------------------- */
/* Support & réclamations                                                  */
/* ---------------------------------------------------------------------- */

let supportState = { categorie:'question', sujet:'', message:'', email:'', busy:false, error:'', ok:'', mesDemandes:null };

function viewSupport(){
if(supportState.mesDemandes === null && !supportState.chargement){
supportState.chargement = true;
sb.from('demandes_support').select('id, categorie, sujet, statut, created_at')
.eq('auteur_id', state.profile.id).order('created_at', { ascending:false }).limit(20)
.then(({ data }) => { supportState.mesDemandes = data || []; supportState.chargement = false; render(); });
}
if(!supportState.email) supportState.email = state.session?.user?.email || '';
const s = supportState;

return `
<div class="row between wrap" style="margin-bottom:14px;">
<h2>Support & réclamations</h2>
</div>
<div class="card">
<div class="hint" style="margin-bottom:12px;">
Une question, un souci, une réclamation ? Écrivez-nous ici : votre message part directement
chez WiDIAG MQ (<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>) et vous recevrez la réponse par email.
</div>
${s.error ? `<div class="alert alert-error">${s.error}</div>` : ''}
${s.ok ? `<div class="alert alert-success">${esc(s.ok)}</div>` : ''}
<form data-action="submit-support">
<div class="grid-2">
<div class="field"><label>Motif</label>
<select name="categorie">
${CATEGORIES_SUPPORT.map(c => `<option value="${c.v}" ${c.v === s.categorie ? 'selected' : ''}>${c.l}</option>`).join('')}
</select></div>
<div class="field"><label>Votre email de réponse</label>
<input type="email" name="email" value="${esc(s.email)}" required></div>
</div>
<div class="field"><label>Sujet <span class="oblig">obligatoire</span></label>
<input type="text" name="sujet" value="${esc(s.sujet)}" placeholder="En quelques mots" required></div>
<div class="field"><label>Message <span class="oblig">obligatoire</span></label>
<textarea name="message" rows="6" placeholder="Décrivez votre demande : équipement concerné, ce qui s'est passé…" required>${esc(s.message)}</textarea></div>
<button class="btn btn-primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Envoi…' : 'Envoyer au support'}</button>
</form>
</div>

${s.mesDemandes && s.mesDemandes.length ? `
<div class="card">
<h3>Mes demandes</h3>
${s.mesDemandes.map(d => `
<div class="list-item">
<div style="flex:1;min-width:0;">
<div style="font-weight:650;">${esc(d.sujet)}</div>
<div class="small muted">${esc((CATEGORIES_SUPPORT.find(c => c.v === d.categorie) || {}).l || d.categorie)} · ${fmtDateTime(d.created_at)}</div>
</div>
${badgeStatutSupport(d.statut)}
</div>`).join('')}
</div>` : ''}
`;
}

function badgeStatutSupport(st){
if(st === 'traite') return '<span class="badge badge-ok">traité</span>';
if(st === 'en_cours') return '<span class="badge badge-warn">en cours</span>';
return '<span class="badge badge-neutral">nouveau</span>';
}

async function submitSupport(form){
const fd = new FormData(form);
const s = supportState;
s.categorie = fd.get('categorie') || 'question';
s.email = (fd.get('email') || '').trim();
s.sujet = (fd.get('sujet') || '').trim();
s.message = (fd.get('message') || '').trim();
s.error = ''; s.ok = '';
if(!s.sujet || !s.message){ s.error = 'Le sujet et le message sont obligatoires.'; render(); return; }
s.busy = true; render();

let enregistre;
try{
const { data, error } = await sb.rpc('envoyer_demande_support', {
p_categorie: s.categorie, p_sujet: s.sujet, p_message: s.message, p_email: s.email,
});
if(error) throw error;
enregistre = data || {};
}catch(e){
s.busy = false; s.error = esc(e.message); render(); return;
}

// Envoi de l'email au support. La demande est DÉJÀ enregistrée en base :
// si l'email échoue, rien n'est perdu, WiDIAG MQ la voit dans Réglages > Support.
const categorieLib = (CATEGORIES_SUPPORT.find(c => c.v === s.categorie) || {}).l || s.categorie;
let mailOk = false;
try{
const r = await fetch('https://formsubmit.co/ajax/' + SUPPORT_EMAIL, {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
body: JSON.stringify({
_subject: `[WiTracEQUIP] ${categorieLib} — ${s.sujet}`,
_template: 'table',
_captcha: 'false',
name: enregistre.auteur || '',
email: s.email,
Client: (enregistre.organisation || '') + (enregistre.code_client ? ' (' + enregistre.code_client + ')' : ''),
Motif: categorieLib,
Sujet: s.sujet,
message: s.message,
}),
});
const j = await r.json().catch(() => ({}));
mailOk = r.ok && String(j.success) === 'true';
}catch(e){ mailOk = false; }

s.busy = false;
s.sujet = ''; s.message = '';
s.ok = mailOk
? 'Merci, votre demande a bien été envoyée au support. Vous recevrez une réponse par email.'
: `Votre demande est bien enregistrée et sera traitée par WiDIAG MQ. (L'email automatique n'a pas pu partir — si c'est urgent, écrivez directement à ${SUPPORT_EMAIL}.)`;
s.mesDemandes = null;
render();
}

/* Onglet Support des réglages (super-admin).
   « À traiter » ne montre que ce qui attend une action ; une demande marquée
   traitée passe dans « Traitées » (archivées, toujours consultables), et peut
   être supprimée définitivement. */
function chargerSupport(force){
if(reglages.supportLoading || (reglages.support !== null && !force)) return;
reglages.supportLoading = true;
listDemandesSupport()
.then(d => { reglages.support = d; reglages.supportError = ''; })
.catch(e => { reglages.supportError = e.message; })
.finally(() => { reglages.supportLoading = false; render(); });
}

function viewSupportAdmin(){
chargerSupport(false);
if(reglages.supportError) return `<div class="alert alert-error">${esc(reglages.supportError)}</div>`;
if(reglages.support === null) return squeletteListe(3);

const ouvertes = reglages.support.filter(d => d.statut !== 'traite');
const traitees = reglages.support.filter(d => d.statut === 'traite');
const filtre = reglages.supportFiltre === 'traitees' ? 'traitees' : 'ouvertes';
const liste = filtre === 'traitees' ? traitees : ouvertes;

return `
<div class="row between wrap" style="margin-bottom:12px;gap:10px;">
<div class="segment">
<button class="${filtre === 'ouvertes' ? 'active' : ''}" data-action="support-filtre" data-filtre="ouvertes">À traiter <span class="onglet-compteur ${ouvertes.length ? 'alerte' : ''}">${ouvertes.length}</span></button>
<button class="${filtre === 'traitees' ? 'active' : ''}" data-action="support-filtre" data-filtre="traitees">Traitées <span class="onglet-compteur">${traitees.length}</span></button>
</div>
<button class="btn btn-sm" data-action="support-rafraichir">Actualiser</button>
</div>
<div class="card">
${liste.length ? liste.map(d => `
<div class="journal-ligne">
<div class="journal-date">${fmtDateTime(d.created_at)}</div>
<div class="journal-corps">
<div><strong>${esc(d.sujet)}</strong> ${badgeStatutSupport(d.statut)}</div>
<div class="small muted">
${esc((CATEGORIES_SUPPORT.find(c => c.v === d.categorie) || {}).l || d.categorie)}
· ${esc(d.auteur_nom || '')}${d.auteur_email ? ` (<a href="mailto:${esc(d.auteur_email)}">${esc(d.auteur_email)}</a>)` : ''}
${d.organisation_nom ? ' · ' + esc(d.organisation_nom) : ''}${d.code_client ? ' (n° ' + esc(d.code_client) + ')' : ''}
${d.traite_le && d.statut === 'traite' ? ' · traitée le ' + fmtDate(d.traite_le) : ''}
</div>
<div class="support-message">${esc(d.message)}</div>
<div class="row wrap" style="gap:6px;margin-top:6px;">
${d.auteur_email ? `<a class="btn btn-sm" href="mailto:${esc(d.auteur_email)}?subject=${encodeURIComponent('Re: ' + d.sujet)}">Répondre</a>` : ''}
${d.statut === 'nouveau' ? `<button class="btn btn-sm" data-action="support-statut" data-id="${d.id}" data-statut="en_cours">En cours</button>` : ''}
${d.statut !== 'traite'
? `<button class="btn btn-sm btn-primary" data-action="support-statut" data-id="${d.id}" data-statut="traite">Traitée → archiver</button>`
: `<button class="btn btn-sm" data-action="support-statut" data-id="${d.id}" data-statut="nouveau">Remettre à traiter</button>`}
<button class="btn btn-sm btn-danger" data-action="support-supprimer" data-id="${d.id}">Supprimer</button>
</div>
</div>
</div>`).join('') : `<div class="empty small">${filtre === 'traitees' ? 'Aucune demande traitée pour l\'instant.' : 'Rien à traiter 🎉'}</div>`}
</div>`;
}

async function actionSupprimerDemande(id){
const d = (reglages.support || []).find(x => x.id === id);
if(!d) return;
if(!await confirmer(`Supprimer définitivement cette demande ?\n\n« ${d.sujet} » — ${d.auteur_nom || ''}\n\nPour la garder sans l'avoir sous les yeux, utilisez plutôt « Traitée → archiver ».`, { danger:true, ok:'Supprimer' })) return;
try{
await supprimerDemandeSupport(id);
reglages.support = reglages.support.filter(x => x.id !== id);
toast('Demande supprimée');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* ---------------------------------------------------------------------- */
/* Fenêtre modale : archiver / supprimer des équipements                   */
/* ---------------------------------------------------------------------- */

let modal = null;

function ouvrirModalArchiver(ids){
if(!ids.length) return;
modal = { type:'archiver', ids, choix:'', precision:'', busy:false, error:'' };
render();
}

function ouvrirModalSupprimerEquip(ids){
if(!ids.length) return;
modal = { type:'supprimer-equip', ids, precision:'', busy:false, error:'' };
render();
}

function fermerModal(){ modal = null; render(); }

function renderModal(){
if(!modal) return '';
const n = modal.ids.length;
const quoi = n > 1 ? `ces ${n} équipements` : 'cet équipement';

if(modal.type === 'archiver'){
return `
<div class="modal-fond" data-action="modal-fond">
<div class="modal" role="dialog" aria-modal="true">
<h3>Archiver ${quoi}</h3>
<p class="small muted">L'équipement sort du parc actif. Sa fiche et tout son historique restent conservés
et consultables (« Voir les archivés »). Il pourra être restauré.</p>
${modal.error ? `<div class="alert alert-error">${esc(modal.error)}</div>` : ''}
<label>Motif <span class="oblig">obligatoire</span></label>
<div class="motifs">
${MOTIFS_ARCHIVAGE.map(m => `
<label class="motif ${modal.choix === m ? 'actif' : ''}">
<input type="radio" name="motif" value="${esc(m)}" data-action="modal-choix" ${modal.choix === m ? 'checked' : ''}>
<span>${esc(m)}</span>
</label>`).join('')}
</div>
<div class="field" style="margin-top:10px;">
<label>Précision ${modal.choix === 'Autre' ? '<span class="oblig">obligatoire</span>' : '(facultatif)'}</label>
<input type="text" data-action="modal-precision" value="${esc(modal.precision)}" placeholder="Ex : vendu à la société X, remplacé par…">
</div>
<div class="small muted" style="margin-bottom:12px;">Retrait enregistré au nom de <strong>${esc(nomOperateur())}</strong>.</div>
<div class="row wrap" style="justify-content:flex-end;">
<button class="btn" data-action="modal-fermer">Annuler</button>
<button class="btn btn-primary" data-action="modal-valider" ${modal.busy ? 'disabled' : ''}>${modal.busy ? 'Archivage…' : 'Archiver'}</button>
</div>
</div>
</div>`;
}

if(modal.type === 'supprimer-equip'){
return `
<div class="modal-fond" data-action="modal-fond">
<div class="modal" role="dialog" aria-modal="true">
<h3>Supprimer définitivement ${quoi}</h3>
<div class="alert alert-error" style="margin:8px 0 12px;">
La fiche, son QR code et <strong>tout son historique d'interventions</strong> seront effacés.
Les étiquettes déjà collées ne montreront plus rien. Une copie est gardée dans le journal.
</div>
<p class="small muted">Si l'équipement a simplement quitté le parc (vendu, obsolète…), préférez « Archiver » : l'historique reste consultable.</p>
${modal.error ? `<div class="alert alert-error">${esc(modal.error)}</div>` : ''}
<div class="field">
<label>Motif (facultatif, gardé dans le journal)</label>
<input type="text" data-action="modal-precision" value="${esc(modal.precision)}" placeholder="Ex : doublon, créé par erreur…">
</div>
<div class="row wrap" style="justify-content:flex-end;">
<button class="btn" data-action="modal-fermer">Annuler</button>
<button class="btn btn-danger-plein" data-action="modal-valider" ${modal.busy ? 'disabled' : ''}>${modal.busy ? 'Suppression…' : 'Supprimer définitivement'}</button>
</div>
</div>
</div>`;
}
return '';
}

function nomOperateur(){
return (state.profile?.full_name || state.session?.user?.email || '').trim();
}

async function validerModal(){
if(!modal || modal.busy) return;
if(modal.type === 'archiver'){
if(!modal.choix){ modal.error = 'Choisissez un motif de retrait.'; render(); return; }
if(modal.choix === 'Autre' && !modal.precision.trim()){ modal.error = 'Précisez le motif.'; render(); return; }
const motif = modal.choix + (modal.precision.trim() ? ' — ' + modal.precision.trim() : '');
modal.busy = true; modal.error = ''; render();
try{
const { error } = await sb.from('equipements').update({
archived: true, archived_at: new Date().toISOString(), archived_by: nomOperateur(), archive_reason: motif,
}).in('id', modal.ids).eq('archived', false);
if(error) throw error;
const n = modal.ids.length;
apresActionEquipements();
toast(n > 1 ? n + ' équipements archivés' : 'Équipement archivé');
}catch(e){ modal.busy = false; modal.error = e.message; render(); }
return;
}
if(modal.type === 'supprimer-equip'){
modal.busy = true; modal.error = ''; render();
try{
const { error } = await sb.rpc('supprimer_equipements', { p_ids: modal.ids, p_motif: modal.precision.trim() || null });
if(error) throw error;
const surLaFiche = state.route.name === 'equip' && modal.ids.includes(state.route.param);
const n = modal.ids.length;
apresActionEquipements();
toast(n > 1 ? n + ' équipements supprimés' : 'Équipement supprimé définitivement');
if(surLaFiche) nav('/equipements');
}catch(e){ modal.busy = false; modal.error = e.message; render(); }
}
}

/* Après archivage / suppression : on vide la sélection et on recharge. */
function apresActionEquipements(){
modal = null;
dashboardCache.sel = [];
if(equipDetail.id){ equipDetail.id = null; }   // force le rechargement de la fiche ouverte
reglages.journal = null;
refreshDashboard();
}
