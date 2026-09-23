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
export_donnees: 'Export Excel du parc',
autorisation_ordinateur: 'Ordinateur ouvert (45 min)',
suppression_equipement: 'Équipement supprimé',
archivage_equipement: 'Équipement archivé',
restauration_equipement: 'Équipement restauré',
modification_intervention: 'Intervention modifiée',
suppression_intervention: 'Intervention supprimée',
suppression_membre: 'Membre supprimé',
deplacement_membre: 'Profil changé de client',
reinitialisation_mdp: 'Mot de passe réinitialisé',
liaison_appareil: 'Compte lié à un appareil',
acces_refuse_appareil: 'Connexion refusée (autre appareil)',
liberation_appareil: 'Déconnexion à distance (appareil libéré)',
suppression_client: 'Client supprimé',
suspension_client: 'Client suspendu',
reactivation_client: 'Client réactivé',
};

function isSuperAdmin(){ return state.superAdmin === true; }
function peutReglages(){ return isAdmin() || isSuperAdmin(); }
function nomModele(cle){ return (modelesMetiers().find(m => m.cle === cle) || {}).nom || ''; }

/* Peu d'onglets, chacun avec une seule mission. Les membres et les invitations
   d'un client se gèrent DANS sa fiche : plus d'onglet Membres ni Invitations
   séparés pour le super-admin (même contenu, deux chemins = on s'y perd). */
function ongletsReglages(){
const journal = { cle:'journal', l: isSuperAdmin() ? 'Journal' : 'Historique complet', aide:"Historique complet des suppressions, archivages et modifications : qui, quand et pourquoi. Conservé sans limite de durée." };
if(isSuperAdmin()){
const aTraiter = (reglages.support || []).filter(d => d.statut !== 'traite').length;
return [
{ cle:'clients', l:'Clients', n: reglages.clients ? reglages.clients.filter(c => !c.est_mon_organisation).length : null,
aide:"Ouvrez un client pour voir tout son parc et gérer sa fiche, ses membres et ses invitations." },
{ cle:'support', l:'Support', n: aTraiter || null, alerte: aTraiter > 0,
aide:"Les demandes de vos clients, les statistiques et l’export Excel d’un parc (démonstration comprise), et les modèles métier proposés quand vous créez un client." },
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
if(onglet === 'profils') return isSuperAdmin() ? 'profils' : 'equipe';
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
renommage:null, // { id, valeur, busy, error } : membre dont on modifie le nom
};
}
resetReglages();

function chargerClients(force){
if(!isSuperAdmin() || reglages.clientsLoading) return;
if(reglages.clients !== null && !force) return;
if(reglages.clientsError && !force) return; // pas de relance en boucle sur une erreur
reglages.clientsLoading = true;
listClients()
.then(c => { reglages.clients = c; reglages.clientsError = ''; })
.catch(e => { reglages.clientsError = e.message; })
.finally(() => { reglages.clientsLoading = false; render(); });
}

function chargerMembres(force){
if(reglages.membresLoading) return;
if(reglages.membres !== null && !force) return;
if(reglages.membresError && !force) return;
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
if(isSuperAdmin() && onglet === 'profils') return `
<div class="row between wrap" style="margin-bottom:6px;"><h2>Profils</h2></div>
<div class="reglages-aide">Tous les comptes de vos clients : recherchez par nom, prénom, email ou client, puis modifiez, changez le rôle, suspendez ou supprimez.</div>
${viewProfils()}`;
if(!onglets.some(o => o.cle === onglet)) onglet = onglets[0].cle;
const courant = onglets.find(o => o.cle === onglet);

let contenu = '';
if(onglet === 'clients') contenu = sous ? viewClientDetail(sous) : viewClients();
else if(onglet === 'equipe') contenu = viewMembres() + viewInvitations();
else if(onglet === 'support') contenu = isSuperAdmin()
? sousMenuSupport(['modeles','stats'].includes(sous) ? sous : 'demandes') + (sous === 'modeles' ? viewModelesMetier() : sous === 'stats' ? viewStats() : viewSupportAdmin())
: viewSupportAdmin();
else if(onglet === 'journal') contenu = viewJournal();

// Super-admin : la navigation principale mène déjà à Clients / Support /
// Journal ; pas de seconde rangée d'onglets, juste le titre de la section.
if(isSuperAdmin()){
const titres = { clients:'Clients', support:'Support', journal:'Journal' };
return `
${sous && onglet !== 'support' ? '' : `<div class="row between wrap" style="margin-bottom:6px;"><h2>${titres[onglet]}</h2></div>
${courant?.aide ? `<div class="reglages-aide">${esc(courant.aide)}</div>` : ''}`}
${contenu}`;
}
return `
<div class="row between wrap" style="margin-bottom:10px;">
<h2>Réglages</h2>
<span class="badge badge-role">${esc(state.orgName || '')}</span>
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

/* Liste pensée pour 20, 30, 50 clients et plus : recherche instantanée (nom,
   n°, référent, ville), tri, et des lignes compactes. Le propre compte de
   WiDIAG MQ n'y figure pas : ce n'est pas un client. */
function viewClients(){
chargerClients(false);
chargerMembres(false); // pour compter les invitations en attente de chaque client
if(reglages.clientsError) return `<div class="alert alert-error">${esc(reglages.clientsError)}</div>`;
if(reglages.clients === null) return squeletteListe(6);

const tous = reglages.clients.filter(c => !c.est_mon_organisation);
const rq = (reglages.rechercheClient || '').trim().toLowerCase();
let clients = rq ? tous.filter(c => [c.nom, c.code_client, c.referent, c.adresse, c.telephone, nomModele(c.modele_metier)]
.some(v => (v || '').toLowerCase().includes(rq))) : tous;
const tri = reglages.triClients || 'nom';
clients = [...clients].sort((x, y) =>
tri === 'recents' ? (y.created_at || '').localeCompare(x.created_at || '')
: tri === 'parc' ? (y.nb_equipements - x.nb_equipements)
: x.nom.localeCompare(y.nom, 'fr', { sensitivity:'base' }));
const sel = reglages.selClients;
const tousCoches = clients.length > 0 && clients.every(c => sel.includes(c.id));
const totalParc = tous.reduce((n, c) => n + (c.nb_equipements || 0), 0);

const lignes = clients.map(c => {
const nInv = (reglages.invites || []).filter(i => i.organization_id === c.id).length;
return `
<div class="ligne-select cliquable ligne-client ${sel.includes(c.id) ? 'cochee' : ''}">
<input type="checkbox" class="case-sel" data-action="sel-client" data-id="${c.id}" ${sel.includes(c.id) ? 'checked' : ''}>
<div class="avatar-client" style="--teinte:${teinteClient(c.nom)};">${esc(initials(c.nom))}</div>
<div class="ligne-corps" data-action="go" data-path="/reglages/clients/${c.id}">
<div class="ligne-titre">
${esc(c.nom)}
<span class="code-client">N° ${esc(c.code_client)}</span>
${!c.active ? '<span class="badge badge-off">suspendu</span>' : ''}
${nInv ? `<span class="badge badge-warn">${nInv} invit.</span>` : ''}
</div>
<div class="small muted">
${c.modele_metier ? esc(nomModele(c.modele_metier)) : 'Aucun modèle métier'}${c.referent ? ' · ' + esc(c.referent) : ''}
</div>
</div>
<div class="ligne-chiffres">
<span class="chiffre-client" title="Équipements actifs"><strong>${c.nb_equipements}</strong> équip.</span>
<span class="chiffre-client" title="Membres"><strong>${c.nb_membres}</strong> membre${c.nb_membres > 1 ? 's' : ''}</span>
</div>
<span class="chevron">›</span>
</div>`;
}).join('');

return `
${reglages.clientForm && !reglages.clientForm.id ? renderClientForm() : ''}
<div class="barre-clients">
<div class="recherche-client">
${iconeNav('search', 16)}
<input type="search" placeholder="Rechercher un client : nom, n°, référent, ville…" value="${esc(reglages.rechercheClient || '')}" data-action="recherche-client">
</div>
<select data-action="tri-clients" title="Trier">
<option value="nom" ${tri === 'nom' ? 'selected' : ''}>Nom A → Z</option>
<option value="recents" ${tri === 'recents' ? 'selected' : ''}>Plus récents</option>
<option value="parc" ${tri === 'parc' ? 'selected' : ''}>Plus gros parc</option>
</select>
${!reglages.clientForm ? `<button class="btn btn-primary" data-action="nouveau-client">+ Nouveau client</button>` : ''}
</div>
<div class="small muted" style="margin:0 0 10px 2px;">
${rq ? `${clients.length} résultat${clients.length > 1 ? 's' : ''} sur ${tous.length} clients` : `${tous.length} client${tous.length > 1 ? 's' : ''} · ${totalParc} équipement${totalParc > 1 ? 's' : ''} suivis`}
</div>

${sel.length ? `
<div class="barre-selection">
<strong>${sel.length} sélectionné${sel.length > 1 ? 's' : ''}</strong>
<button class="btn btn-sm" data-action="clients-statut" data-actif="0">Suspendre</button>
<button class="btn btn-sm" data-action="clients-statut" data-actif="1">Réactiver</button>
<button class="btn btn-sm btn-danger" data-action="clients-supprimer">Supprimer</button>
<button class="btn btn-sm btn-lien" data-action="clients-desel">Annuler</button>
</div>` : ''}

<div class="card liste-select">
${clients.length ? `
<label class="tout-selectionner">
<input type="checkbox" data-action="sel-clients-tous" data-ids="${clients.map(c => c.id).join(',')}" ${tousCoches ? 'checked' : ''}>
<span>Tout sélectionner${rq ? ' (résultats)' : ''}</span>
</label>` : ''}
${lignes || `<div class="empty small">${rq ? 'Aucun client ne correspond à « ' + esc(reglages.rechercheClient) + ' ».' : 'Aucun client pour l\'instant. Créez le premier avec « + Nouveau client ».'}</div>`}
</div>
`;
}

/* Une couleur stable par client (dérivée du nom) : on reconnaît chacun d'un coup d'œil. */
function teinteClient(nom){
let h = 0;
for(const ch of String(nom || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
return h;
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
const modele = modelesMetiers().find(m => m.cle === f.modele);
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
${modelesMetiers().map(m => `<option value="${m.cle}" ${m.cle === f.modele ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}
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

if(reglages.parcClientVu !== c.id){ reglages.parcClientVu = c.id; reglages.rechercheParc = ''; reglages.parcArchives = false; }
const enEdition = reglages.clientForm && reglages.clientForm.id === c.id;
chargerParcClient(c.id, false);
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

${renderParcClient(c)}

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

/* ---- Parc d'un client (vue super-admin) ---- */
function chargerParcClient(orgId, force){
reglages.parcs = reglages.parcs || {};
const p = reglages.parcs[orgId];
if(p && (p.loading || (p.items && !force) || (p.error && !force))) return;
reglages.parcs[orgId] = { items: p?.items || null, loading:true, error:'' };
listEquipements({ orgId, showArchived:true })
.then(items => { reglages.parcs[orgId] = { items, loading:false, error:'' }; })
.catch(e => { reglages.parcs[orgId] = { items:null, loading:false, error:e.message }; })
.finally(() => render());
}

function renderParcClient(c){
const p = (reglages.parcs || {})[c.id] || { items:null };
const rq = (reglages.rechercheParc || '').trim().toLowerCase();
const voirArchives = !!reglages.parcArchives;
let items = (p.items || []).filter(e => voirArchives || !e.archived);
if(rq) items = items.filter(e => [e.nom, e.serial_value, (state.types.find(t => t.id === e.type_id) || {}).nom]
.some(v => (v || '').toLowerCase().includes(rq)));
const actifs = (p.items || []).filter(e => !e.archived).length;
const nbTypes = state.types.filter(t => t.organization_id === c.id).length;

// Regroupé par type : 3 extincteurs, 2 ascenseurs… se lisent d'un coup.
const groupes = {};
for(const e of items){ const k = e.type_id; (groupes[k] = groupes[k] || []).push(e); }
const blocs = Object.entries(groupes)
.map(([tid, liste]) => ({ type: state.types.find(t => t.id === tid), liste }))
.sort((a, b) => (a.type?.nom || '').localeCompare(b.type?.nom || '', 'fr'))
.map(({ type, liste }) => `
<div class="parc-groupe">
<div class="parc-groupe-titre">${esc(type?.nom || 'Type inconnu')} <span class="muted">· ${liste.length}</span></div>
${liste.map(e => `
<div class="ligne-select cliquable" data-action="go" data-path="/equip/${e.id}">
<div class="thumb">${esc(initials(e.nom))}</div>
<div class="ligne-corps">
<div class="ligne-titre">${esc(e.nom)} ${e.archived ? '<span class="badge badge-warn">archivé</span>' : ''}</div>
<div class="small muted">${e.serial_value ? 'N/S ' + esc(e.serial_value) : 'Sans n° de série'}</div>
</div>
<span class="chevron">›</span>
</div>`).join('')}
</div>`).join('');

return `
<div class="card carte-parc">
<div class="row between wrap" style="gap:10px;">
<h3 style="margin:0;">Parc <span class="muted" style="font-weight:500;">· ${actifs} équipement${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''}</span></h3>
<div class="row wrap" style="gap:6px;">
<button class="btn btn-sm" data-action="go" data-path="/types/${c.id}">Types (${nbTypes})</button>
<button class="btn btn-sm btn-primary" data-action="nouvel-equip-client" data-id="${c.id}" ${nbTypes ? '' : 'disabled title="Ajoutez d\'abord un type d\'équipement"'}>+ Équipement</button>
</div>
</div>
${(p.items || []).length > 4 ? `
<div class="row wrap" style="gap:10px;margin:12px 0 4px;">
<input type="search" style="flex:1;min-width:180px;" placeholder="Chercher dans le parc : nom, n° de série, type…" value="${esc(reglages.rechercheParc || '')}" data-action="recherche-parc">
<label class="case" style="margin:0;"><input type="checkbox" data-action="parc-archives" ${voirArchives ? 'checked' : ''}><span>Voir les archivés</span></label>
</div>` : ''}
${p.error ? `<div class="alert alert-error">${esc(p.error)}</div>`
: p.items === null ? squeletteListe(3).replace('card liste-select', 'liste-select')
: blocs || `<div class="empty small">${rq ? 'Aucun équipement ne correspond.' : (nbTypes ? 'Aucun équipement pour ce client. Ajoutez le premier avec « + Équipement ».' : "Ce client n'a encore aucun type d'équipement : attribuez-lui un modèle métier (Modifier) ou créez un type.")}</div>`}
</div>`;
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

/* Super-admin : tous les profils de tous les clients, avec recherche. */
function viewProfils(){
chargerMembres(false);
chargerClients(false);
if(reglages.membresError) return `<div class="alert alert-error">${esc(reglages.membresError)}</div>`;
if(reglages.membres === null) return squeletteListe(6);
const rq = (reglages.rechercheProfil || '').trim().toLowerCase();
const tous = [...reglages.membres].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'fr', { sensitivity:'base' }));
const liste = rq ? tous.filter(m => [m.full_name, reglages.emails[m.id]?.email, m.organizations?.nom, roleLabel(m.role)]
.some(v => (v || '').toLowerCase().includes(rq))) : tous;
const actifs = tous.filter(m => m.active && m.id !== state.profile?.id).length;
return `
<div class="barre-clients">
<div class="recherche-client">
${iconeNav('search', 16)}
<input type="search" placeholder="Rechercher un profil : nom, prénom, email, client…" value="${esc(reglages.rechercheProfil || '')}" data-action="recherche-profil">
</div>
</div>
<div class="small muted" style="margin:0 0 10px 2px;">
${rq ? `${liste.length} résultat${liste.length > 1 ? 's' : ''} sur ${tous.length} profils` : `${tous.length} profil${tous.length > 1 ? 's' : ''} · ${actifs} actif${actifs > 1 ? 's' : ''} (hors vous)`}
</div>
<div class="card">
<h3>Comptes créés (${liste.length})</h3>
${liste.length ? renderListeMembres(liste, true) : `<div class="empty small">Aucun profil ne correspond à « ${esc(reglages.rechercheProfil || '')} ».</div>`}
</div>
${(() => {
// Personnes invitées qui n'ont pas encore créé leur compte : elles font aussi partie des personnes ajoutées.
const inv = (reglages.invites || []).filter(i => !rq || [i.label, i.organizations?.nom, roleLabel(i.role)].some(v => (v || '').toLowerCase().includes(rq)));
return inv.length ? `<div class="card"><h3>Invitées, compte pas encore créé (${inv.length})</h3>${inv.map(i => renderInvite(i, true)).join('')}</div>` : '';
})()}`;
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
<div class="thumb role-${m.fondateur ? 'fondateur' : esc(m.role)}">${esc(initials(m.full_name))}</div>
<div class="who">
${peutRenommer(m) && reglages.renommage?.id === m.id ? renderRenommage() : `
<div style="font-weight:650;">
${esc(m.full_name || 'Sans nom')}
${peutRenommer(m) ? `<button class="btn-crayon" data-action="renommer-membre" data-id="${m.id}" title="Modifier le nom et le prénom">✎</button>` : ''}
${estMoi ? '<span class="small muted">(vous)</span>' : ''}
${m.fondateur ? '<span class="badge badge-neutral">fondateur</span>' : ''}
${!m.active ? '<span class="badge badge-off">suspendu</span>' : ''}
</div>`}
${isSuperAdmin() && !estMoi ? `<div class="small appareil-ligne">${iconeNav('smartphone', 13)} ${m.appareil_lie_le
? `Appareil autorisé : <strong>${esc(m.appareil_info || 'un appareil')}</strong> depuis le ${fmtDate(m.appareil_lie_le)}${m.ordi_expire_le && new Date(m.ordi_expire_le) > new Date() ? ` · <span class="ordi-actif">${iconeNav('monitor', 13)} ordinateur ouvert jusqu'à ${esc(new Date(m.ordi_expire_le).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }))}${m.ordi_info ? ' (' + esc(m.ordi_info) + ')' : ''}</span>` : ''}`
: `<span class="muted">Aucun appareil lié : le premier utilisé sera retenu</span>`}</div>` : ''}
<div class="small muted">
${email ? esc(email) + ' · ' : ''}membre depuis le ${fmtDate(m.created_at)}
${avecClient && m.organizations ? ` · <a href="#/reglages/clients/${m.organization_id}">${esc(m.organizations.nom)}</a>` : ''}
</div>
</div>
${verrouille
? `<span class="badge badge-role role-${m.fondateur ? 'fondateur' : esc(m.role)}">${esc(m.fondateur ? 'Fondateur' : roleLabel(m.role))}</span>`
: `<select data-action="member-role" data-id="${m.id}">
${ROLES_ASSIGNABLES.map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}
</select>`}
${isSuperAdmin() && !estMoi ? `<button class="btn btn-sm btn-mdp" data-action="reset-mdp" data-id="${m.id}" title="Donner un mot de passe provisoire">${iconeNav('key', 15)} Mot de passe</button>
<button class="btn btn-sm btn-mdp btn-deco" data-action="liberer-appareil" data-id="${m.id}" title="Téléphone perdu, volé ou remplacé : déconnecter cette personne partout et lui permettre de se reconnecter sur un nouvel appareil">${iconeNav('logout', 15)} Déconnecter</button>` : ''}
${isSuperAdmin() && !verrouille ? `
<label class="choix-client">
<span>Client</span>
<select data-action="deplacer-membre" data-id="${m.id}">
${[...(reglages.clients || [])].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(c => `<option value="${c.id}" ${c.id === m.organization_id ? 'selected' : ''}>${esc(c.nom)}${c.est_mon_organisation ? ' (votre entreprise)' : ''}</option>`).join('')}
</select>
</label>` : ''}
${blocAcces}
</div>`;
}

/* Fondateur : déconnexion à distance (téléphone perdu, volé ou remplacé).
   La base ferme toutes les sessions de la personne et oublie son appareil :
   l'ancien téléphone est éjecté (contrôle toutes les 60 s et à chaque retour
   au premier plan) et ses données locales sont effacées ; le prochain
   appareil utilisé devient l'appareil autorisé. */
async function actionLibererAppareil(id){
const m = (reglages.membres || []).find(x => x.id === id);
if(!m) return;
const nom = m.full_name || 'ce profil';
if(!await confirmer(`Déconnecter ${nom} à distance ?\n\n• ${nom} est déconnecté(e) de tous ses appareils${m.appareil_info ? ` (actuellement : ${m.appareil_info})` : ''}, en moins d'une minute dès que l'appareil capte le réseau.\n• Les données gardées sur l'ancien appareil sont effacées.\n• ${nom} pourra se reconnecter avec son e-mail et son mot de passe sur un nouvel appareil, qui deviendra son appareil autorisé.\n\nTéléphone perdu ou volé : pensez aussi à lui donner un nouveau mot de passe (bouton « Mot de passe »).`, { ok:'Déconnecter à distance', danger:true })) return;
try{
await libererAppareil(id);
m.appareil_info = null; m.appareil_lie_le = null;
reglages.journal = null;
toast(`${nom} est déconnecté(e) : reconnexion possible sur un nouvel appareil`);
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

/* Nom et prénom : modifiables par l'administrateur (et le super-admin) pour
   les membres qu'il gère, et par chacun pour lui-même. Les interventions
   déjà enregistrées gardent le nom saisi à l'époque : c'est l'historique. */
function peutRenommer(m){ return m.id === state.profile?.id || !membreVerrouille(m); }

function renderRenommage(){
const r = reglages.renommage;
return `
<form class="renommage" data-action="submit-renommer">
<input type="text" name="nom" value="${esc(r.valeur)}" placeholder="Prénom Nom" maxlength="80" autocomplete="off" required>
<button class="btn btn-sm btn-primary" type="submit" ${r.busy ? 'disabled' : ''}>${r.busy ? '…' : 'Enregistrer'}</button>
<button class="btn btn-sm" type="button" data-action="renommer-annuler">Annuler</button>
${r.error ? `<div class="small" style="color:var(--danger);width:100%;">${esc(r.error)}</div>` : ''}
</form>`;
}

function ouvrirRenommage(id){
const m = (reglages.membres || []).find(x => x.id === id);
if(!m) return;
reglages.renommage = { id, valeur: m.full_name || '', busy:false, error:'' };
render();
requestAnimationFrame(() => { const i = document.querySelector('.renommage input'); if(i){ i.focus(); i.select(); } });
}

async function submitRenommage(form){
const r = reglages.renommage;
if(!r) return;
const nom = (new FormData(form).get('nom') || '').toString().trim().replace(/\s+/g, ' ');
if(nom.length < 2){ r.error = 'Indiquez au moins le prénom et le nom.'; render(); return; }
r.valeur = nom; r.busy = true; r.error = ''; render();
try{
await renommerMembre(r.id, nom);
const m = (reglages.membres || []).find(x => x.id === r.id);
if(m) m.full_name = nom;
if(r.id === state.profile?.id) state.profile.full_name = nom;
reglages.renommage = null;
toast('Nom mis à jour');
render();
}catch(e){ r.busy = false; r.error = e.message; render(); }
}

/* Super-admin : rattacher un profil existant à un autre client (sans recréer de compte). */
async function actionDeplacerMembre(id, orgId){
const m = (reglages.membres || []).find(x => x.id === id);
const cible = (reglages.clients || []).find(c => c.id === orgId);
if(!m || !cible || m.organization_id === orgId){ render(); return; }
const ancien = (reglages.clients || []).find(c => c.id === m.organization_id)?.nom || 'son client actuel';
if(!await confirmer(`Rattacher ${m.full_name || 'ce profil'} à ${cible.nom} ?\n\nLa personne quitte ${ancien} et accède dès sa prochaine ouverture de l'appli à tout le parc de ${cible.nom}, avec son rôle actuel (${roleLabel(m.role)}). Vous pourrez ensuite limiter ses accès à certains types. Le changement est tracé dans le journal.`, { ok:'Rattacher' })){ render(); return; }
try{
await deplacerProfil(id, orgId);
toast(`${m.full_name || 'Profil'} rattaché à ${cible.nom}`);
reglages.journal = null;
rafraichirReglages();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); rafraichirReglages(); }
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
${clients.filter(c => c.active && !c.est_mon_organisation).map(c => `<option value="${c.id}" ${c.id === inv.orgId ? 'selected' : ''}>${esc(c.nom)} — n° ${esc(c.code_client)}</option>`).join('')}
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
if(reglages.journal === null && !reglages.journalLoading && !reglages.journalError){
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
${isSuperAdmin() ? `<button class="icon-btn btn-poubelle journal-suppr" data-action="journal-suppr" data-id="${j.id}" title="Supprimer cette ligne">${iconeNav('trash', 16)}</button>` : ''}
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
<div class="row wrap" style="gap:6px;">
<button class="btn btn-sm" data-action="journal-rafraichir">Actualiser</button>
${isSuperAdmin() && reglages.journal.length ? `<button class="btn btn-sm btn-danger" data-action="journal-vider">Vider le journal</button>` : ''}
</div>
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
if(reglages.supportError && !force) return;
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

async function actionSupprimerJournal(id){
const j = (reglages.journal || []).find(x => x.id === id);
if(!j) return;
if(!await confirmer(`Supprimer cette ligne du journal ?\n\n${LIBELLES_JOURNAL[j.action] || j.action} — ${j.libelle || ''}`, { danger:true, ok:'Supprimer' })) return;
try{
await supprimerJournal([id]);
reglages.journal = reglages.journal.filter(x => x.id !== id);
toast('Ligne supprimée');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
}

async function actionViderJournal(){
const n = (reglages.journal || []).length;
if(!n) return;
if(!await confirmer(`Vider tout le journal ?\n\nLes ${n} ligne${n > 1 ? 's' : ''} de traçabilité (suppressions, archivages, modifications) de tous vos clients seront effacées définitivement.`, { danger:true, ok:'Vider le journal' })) return;
try{
await supprimerJournal(null);
reglages.journal = [];
toast('Journal vidé');
render();
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); }
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
if(surLaFiche) nav(routeParc(equipDetail.item?.organization_id));
}catch(e){ modal.busy = false; modal.error = e.message; render(); }
}
}

/* Après archivage / suppression : on vide la sélection et on recharge. */
function apresActionEquipements(){
modal = null;
chargerActivite(true);
reglages.parcs = {};
dashboardCache.sel = [];
if(equipDetail.id){ equipDetail.id = null; }   // force le rechargement de la fiche ouverte
reglages.journal = null;
refreshDashboard();
}

/* ---------------------------------------------------------------------- */
/* Support → Modèles métier (fondateur)                                    */
/* ---------------------------------------------------------------------- */
/* Les modèles proposés à la création d'un client (et dans « Partir d'un
modèle métier » de la page Types). Modifier un modèle ne change pas les
types déjà créés chez les clients : ils leur appartiennent. */

let modeleEdit = null; // { nouveau, cle, nom, description, types:[{nom, champs:[{label,type}]}], ouverts:[], busy, error }

function sousMenuSupport(actif){
const aTraiter = (reglages.support || []).filter(d => d.statut !== 'traite').length;
const nb = (state.modeles || []).length;
return `
<div class="sous-menu" role="tablist">
<button class="${actif === 'demandes' ? 'active' : ''}" data-action="go" data-path="/reglages/support">${iconeNav('inbox', 16)} Demandes clients ${aTraiter ? `<span class="onglet-compteur alerte">${aTraiter}</span>` : ''}</button>
<button class="${actif === 'stats' ? 'active' : ''}" data-action="go" data-path="/reglages/support/stats">${iconeNav('chart', 16)} Statistiques &amp; export</button>
<button class="${actif === 'modeles' ? 'active' : ''}" data-action="go" data-path="/reglages/support/modeles">${iconeNav('tag', 16)} Modèles métier <span class="onglet-compteur">${nb}</span></button>
</div>`;
}

function copieModele(m){ return JSON.parse(JSON.stringify(m)); }

function viewModelesMetier(){
if(modeleEdit) return renderModeleEdit();
const liste = state.modeles || [];
const clients = (reglages.clients || []).filter(c => !c.est_mon_organisation);
return `
<div class="row between wrap" style="margin-bottom:12px;gap:10px;">
<div class="hint" style="margin:0;flex:1;min-width:220px;">Proposés quand vous créez un client, et dans « Partir d'un modèle métier » de la page Types.
Les modifier ne change rien chez les clients déjà créés.</div>
<button class="btn btn-primary" data-action="mm-nouveau">+ Nouveau métier</button>
</div>
${liste.length ? `<div class="mm-grille">
${liste.map(m => {
const nbChamps = (m.types || []).reduce((n, t) => n + (t.champs || []).length, 0);
const utilisateurs = clients.filter(c => c.modele_metier === m.cle).length;
return `
<div class="card mm-carte">
<div class="mm-titre">${esc(m.nom)}</div>
${m.description ? `<div class="small muted">${esc(m.description)}</div>` : ''}
<div class="mm-chiffres small">${(m.types || []).length} type${(m.types || []).length > 1 ? 's' : ''} · ${nbChamps} champ${nbChamps > 1 ? 's' : ''}${utilisateurs ? ` · <strong>${utilisateurs} client${utilisateurs > 1 ? 's' : ''}</strong>` : ''}</div>
<div class="mm-types">${(m.types || []).map(t => `<span class="mm-puce">${esc(t.nom)}</span>`).join('')}</div>
<div class="row mm-actions">
<button class="btn btn-sm btn-primary" data-action="mm-modifier" data-cle="${esc(m.cle)}">${iconeNav('pencil', 14)} Modifier</button>
<button class="btn btn-sm" data-action="mm-dupliquer" data-cle="${esc(m.cle)}">Dupliquer</button>
<button class="icon-btn btn-poubelle mm-suppr" data-action="mm-supprimer" data-cle="${esc(m.cle)}" title="Supprimer ce métier" aria-label="Supprimer ce métier">${iconeNav('trash', 17)}</button>
</div>
</div>`;}).join('')}
</div>` : `<div class="card empty"><div class="empty-icone">${iconeNav('tag', 30)}</div><strong>Aucun modèle métier</strong><br><span class="small">Créez-en un pour préparer d'un coup le parc type d'un secteur.</span></div>`}`;
}

function renderModeleEdit(){
const e = modeleEdit;
const typesHtml = e.types.map((t, i) => {
const ouvert = e.ouverts.includes(i);
return `
<div class="mm-type ${ouvert ? 'ouvert' : ''}">
<div class="mm-type-tete">
<button type="button" class="mm-type-plier" data-action="mm-type-plier" data-t="${i}" aria-expanded="${ouvert}" title="${ouvert ? 'Replier' : 'Voir les champs'}">${ouvert ? '▾' : '▸'}</button>
<input type="text" class="mm-type-nom" placeholder="Nom du type (ex : Extincteur)" value="${esc(t.nom)}" data-action="mm-type-nom" data-t="${i}">
<span class="small muted mm-type-n">${t.champs.length} champ${t.champs.length > 1 ? 's' : ''}</span>
<div class="mm-type-actions">
<button type="button" class="icon-btn" data-action="mm-type-deplacer" data-t="${i}" data-sens="-1" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
<button type="button" class="icon-btn" data-action="mm-type-deplacer" data-t="${i}" data-sens="1" title="Descendre" ${i === e.types.length - 1 ? 'disabled' : ''}>↓</button>
<button type="button" class="icon-btn btn-poubelle" data-action="mm-type-suppr" data-t="${i}" title="Retirer ce type">${iconeNav('trash', 16)}</button>
</div>
</div>
${ouvert ? `
<div class="mm-champs">
${t.champs.length ? t.champs.map((c, j) => `
<div class="mm-champ">
<input type="text" placeholder="Nom du champ (ex : Date de fabrication)" value="${esc(c.label)}" data-action="mm-champ-label" data-t="${i}" data-c="${j}">
<select data-action="mm-champ-type" data-t="${i}" data-c="${j}">
${CHAMP_TYPES.map(ct => `<option value="${ct.v}" ${ct.v === c.type ? 'selected' : ''}>${ct.l}</option>`).join('')}
</select>
<div class="mm-champ-actions">
<button type="button" class="icon-btn" data-action="mm-champ-deplacer" data-t="${i}" data-c="${j}" data-sens="-1" title="Monter" ${j === 0 ? 'disabled' : ''}>↑</button>
<button type="button" class="icon-btn" data-action="mm-champ-deplacer" data-t="${i}" data-c="${j}" data-sens="1" title="Descendre" ${j === t.champs.length - 1 ? 'disabled' : ''}>↓</button>
<button type="button" class="icon-btn" data-action="mm-champ-suppr" data-t="${i}" data-c="${j}" title="Retirer ce champ">✕</button>
</div>
</div>`).join('') : `<div class="small muted" style="margin-bottom:8px;">Aucun champ : l'équipement n'aura que son nom et son n° de série.</div>`}
<button type="button" class="btn btn-sm" data-action="mm-champ-ajouter" data-t="${i}">+ Ajouter un champ</button>
</div>` : ''}
</div>`;
}).join('');

return `
<div class="card">
<div class="row between wrap" style="gap:10px;margin-bottom:10px;">
<h3>${e.nouveau ? 'Nouveau métier' : 'Modifier le métier'}</h3>
<button class="btn btn-sm btn-lien" data-action="mm-annuler">← Retour aux métiers</button>
</div>
${e.error ? `<div class="alert alert-error">${esc(e.error)}</div>` : ''}
<div class="grid-2">
<div class="field">
<label>Nom du métier <span class="oblig">obligatoire</span></label>
<input type="text" placeholder="Ex : Restauration collective" value="${esc(e.nom)}" data-action="mm-nom">
</div>
<div class="field">
<label>Description</label>
<input type="text" placeholder="Une phrase pour le reconnaître" value="${esc(e.description)}" data-action="mm-desc">
</div>
</div>

<div class="row between wrap" style="gap:8px;margin:6px 0 8px;">
<label style="margin:0;">Types d'équipement (${e.types.length})</label>
${e.types.length ? `<button type="button" class="btn btn-sm btn-lien" data-action="mm-tout-plier">${e.ouverts.length ? 'Tout replier' : 'Tout déplier'}</button>` : ''}
</div>
<div class="mm-types-liste">${typesHtml || `<div class="small muted" style="margin-bottom:8px;">Aucun type pour l'instant.</div>`}</div>
<button type="button" class="btn btn-sm" data-action="mm-type-ajouter">+ Ajouter un type d'équipement</button>

<div class="hint" style="margin-top:14px;">Les changements s'appliquent aux prochains clients créés avec ce métier.
Les types déjà créés chez vos clients ne bougent pas : modifiez-les depuis la fiche du client → Types.</div>
<div class="row wrap" style="margin-top:14px;gap:8px;">
<button class="btn btn-primary" data-action="mm-enregistrer" ${e.busy ? 'disabled' : ''}>${e.busy ? 'Enregistrement…' : (e.nouveau ? 'Créer le métier' : 'Enregistrer')}</button>
<button class="btn" data-action="mm-annuler">Annuler</button>
</div>
</div>`;
}

function ouvrirModele(cle, dupliquer){
if(!cle){
modeleEdit = { nouveau:true, cle:null, nom:'', description:'', types:[{ nom:'', champs:[{ label:'', type:'text' }] }], ouverts:[0], busy:false, error:'' };
} else {
const m = (state.modeles || []).find(x => x.cle === cle);
if(!m) return;
const c = copieModele(m);
modeleEdit = { nouveau: !!dupliquer, cle: dupliquer ? null : c.cle, ordre: c.ordre,
nom: dupliquer ? c.nom + ' (copie)' : c.nom, description: c.description || '',
types: (c.types || []).map(t => ({ nom: t.nom || '', champs: (t.champs || []).map(x => ({ label: x.label || '', type: x.type || 'text' })) })),
ouverts: [], busy:false, error:'' };
}
render(); remonterEnHaut();
}

function deplacer(liste, i, sens){
const j = i + sens;
if(j < 0 || j >= liste.length) return false;
[liste[i], liste[j]] = [liste[j], liste[i]];
return true;
}

const CLICS_MODELE = ['mm-nouveau','mm-modifier','mm-dupliquer','mm-supprimer','mm-annuler','mm-enregistrer','mm-type-ajouter',
'mm-type-plier','mm-tout-plier','mm-type-deplacer','mm-type-suppr','mm-champ-ajouter','mm-champ-suppr','mm-champ-deplacer'];

function actionModele(action, t){
if(!CLICS_MODELE.includes(action)) return; // un clic dans un champ de saisie ne redessine rien
const e = modeleEdit;
const i = +t.dataset.t, j = +t.dataset.c, sens = +t.dataset.sens;
if(action === 'mm-nouveau') return ouvrirModele(null);
if(action === 'mm-modifier') return ouvrirModele(t.dataset.cle);
if(action === 'mm-dupliquer') return ouvrirModele(t.dataset.cle, true);
if(action === 'mm-supprimer') return actionSupprimerModele(t.dataset.cle);
if(!e) return;
if(action === 'mm-annuler'){ modeleEdit = null; }
else if(action === 'mm-enregistrer'){ return actionEnregistrerModele(); }
else if(action === 'mm-type-ajouter'){
e.types.push({ nom:'', champs:[{ label:'', type:'text' }] });
e.ouverts = [...e.ouverts, e.types.length - 1];
render();
requestAnimationFrame(() => { const l = document.querySelectorAll('.mm-type-nom'); l[l.length - 1]?.focus(); });
return;
}
else if(action === 'mm-type-plier'){ e.ouverts = e.ouverts.includes(i) ? e.ouverts.filter(x => x !== i) : [...e.ouverts, i]; }
else if(action === 'mm-tout-plier'){ e.ouverts = e.ouverts.length ? [] : e.types.map((_, k) => k); }
else if(action === 'mm-type-deplacer'){
if(deplacer(e.types, i, sens)){
// Les types dépliés suivent leur type.
e.ouverts = e.ouverts.map(k => k === i ? i + sens : (k === i + sens ? i : k));
}
}
else if(action === 'mm-type-suppr'){
const ty = e.types[i];
const vide = !ty.nom.trim() && !ty.champs.some(c => c.label.trim());
const faire = () => { e.types.splice(i, 1); e.ouverts = e.ouverts.filter(k => k !== i).map(k => k > i ? k - 1 : k); render(); };
if(vide) return faire();
confirmer(`Retirer le type « ${ty.nom || 'sans nom'} » de ce métier ?\n\nRien n'est effacé chez vos clients.`, { ok:'Retirer' }).then(ok => { if(ok) faire(); });
return;
}
else if(action === 'mm-champ-ajouter'){
e.types[i].champs.push({ label:'', type:'text' });
render();
requestAnimationFrame(() => { const l = document.querySelectorAll(`[data-action="mm-champ-label"][data-t="${i}"]`); l[l.length - 1]?.focus(); });
return;
}
else if(action === 'mm-champ-suppr'){ e.types[i].champs.splice(j, 1); }
else if(action === 'mm-champ-deplacer'){ deplacer(e.types[i].champs, j, sens); }
render();
}

function saisieModele(action, t){
const e = modeleEdit; if(!e) return;
const i = +t.dataset.t, j = +t.dataset.c;
if(action === 'mm-nom') e.nom = t.value;
else if(action === 'mm-desc') e.description = t.value;
else if(action === 'mm-type-nom') e.types[i].nom = t.value;
else if(action === 'mm-champ-label') e.types[i].champs[j].label = t.value;
else if(action === 'mm-champ-type') e.types[i].champs[j].type = t.value;
}

async function actionEnregistrerModele(){
const e = modeleEdit;
e.error = '';
const nom = e.nom.trim().replace(/\s+/g, ' ');
if(!nom){ e.error = 'Donnez un nom au métier.'; render(); remonterEnHaut(); return; }
const autres = (state.modeles || []).filter(m => m.cle !== e.cle);
if(autres.some(m => m.nom.trim().toLowerCase() === nom.toLowerCase())){ e.error = `Un métier s'appelle déjà « ${nom} ».`; render(); remonterEnHaut(); return; }
const types = e.types
.map(t => ({ nom: t.nom.trim().replace(/\s+/g, ' '), champs: t.champs.map(c => ({ label: c.label.trim().replace(/\s+/g, ' '), type: c.type })).filter(c => c.label) }))
.filter(t => t.nom || t.champs.length);
const sansNom = types.findIndex(t => !t.nom);
if(sansNom >= 0){ e.error = `Le type n° ${sansNom + 1} n'a pas de nom.`; e.ouverts = [...new Set([...e.ouverts, sansNom])]; render(); remonterEnHaut(); return; }
const vus = new Set();
for(const t of types){
const k = t.nom.toLowerCase();
if(vus.has(k)){ e.error = `Le type « ${t.nom} » apparaît deux fois.`; render(); remonterEnHaut(); return; }
vus.add(k);
const labels = new Set();
for(const c of t.champs){
const kc = slugify(c.label);
if(labels.has(kc)){ e.error = `Dans « ${t.nom} », le champ « ${c.label} » apparaît deux fois.`; render(); remonterEnHaut(); return; }
labels.add(kc);
}
}
let cle = e.cle;
if(e.nouveau){
const base = slugify(nom).slice(0, 40) || 'metier';
cle = base; let n = 2;
while((state.modeles || []).some(m => m.cle === cle)) cle = base + '_' + (n++);
}
const ordre = e.nouveau ? Math.max(0, ...(state.modeles || []).map(m => m.ordre || 0)) + 1 : (e.ordre || 0);
e.busy = true; render();
try{
await enregistrerModele({ cle, nom, description: e.description.trim(), types, ordre }, e.nouveau);
await chargerModeles();
modeleEdit = null;
toast(e.nouveau ? `Métier « ${nom} » créé` : `Métier « ${nom} » enregistré`);
}catch(err){
e.busy = false; e.error = err.message;
}
render();
}

async function actionSupprimerModele(cle){
const m = (state.modeles || []).find(x => x.cle === cle);
if(!m) return;
const n = (reglages.clients || []).filter(c => !c.est_mon_organisation && c.modele_metier === cle).length;
if(!await confirmer(`Supprimer le métier « ${m.nom} » ?\n\nIl ne sera plus proposé pour les nouveaux clients.` +
(n ? ` ${n} client${n > 1 ? 's le portent : leurs équipements et leurs types restent' : ' le porte : ses équipements et ses types restent'} intacts, seule l'étiquette du métier est retirée.` : ' Aucun client ne l\'utilise.'),
{ danger:true, ok:'Supprimer' })) return;
try{
await supprimerModele(cle);
await chargerModeles();
if(n) chargerClients(true);
toast('Métier supprimé');
render();
}catch(err){ toast('Erreur : ' + err.message, 'erreur'); }
}

/* ---------------------------------------------------------------------- */
/* Journal d'activité (tous les utilisateurs, sql/21)                      */
/* ---------------------------------------------------------------------- */
/* Ce qui s'est passé sur le parc ces 7 derniers jours. Chacun archive ses
notifications et peut les revoir ; tout disparaît au bout d'une semaine.
Le journal complet (traçabilité) reste dans Réglages → Historique complet. */

let activite = { items:null, loading:false, error:'', filtre:'recentes' };

const GENRES_ACTIVITE = {
intervention:              { l:'Intervention ajoutée',   ico:'wrench', c:'bleu' },
equipement_cree:           { l:'Équipement créé',        ico:'plus',   c:'vert' },
archivage_equipement:      { l:'Équipement archivé',     ico:'archive',c:'or' },
restauration_equipement:   { l:'Équipement restauré',    ico:'undo',   c:'vert' },
suppression_equipement:    { l:'Équipement supprimé',    ico:'trash',  c:'rouge' },
modification_intervention: { l:'Intervention modifiée',  ico:'pencil', c:'bleu' },
suppression_intervention:  { l:'Intervention supprimée', ico:'trash',  c:'rouge' },
};

function nbActiviteNonLue(){ return (activite.items || []).filter(a => !a.archivee).length; }

function chargerActivite(force){
if(isSuperAdmin() || activite.loading) return;
if(activite.items !== null && !force) return;
if(activite.error && !force) return;
activite.loading = true;
sb.rpc('fil_activite')
.then(({ data, error }) => {
if(error) throw error;
activite.items = data || []; activite.error = '';
})
.catch(e => { activite.error = estErreurReseau(e) ? 'Journal indisponible sans réseau : il se mettra à jour au retour de la connexion.' : e.message; })
.finally(() => { activite.loading = false; render(); });
}

async function basculerArchiveActivite(cle, archiver){
const a = (activite.items || []).find(x => x.cle === cle);
if(!a) return;
a.archivee = archiver; render(); // effet immédiat, la base suit
try{
const q = archiver
? sb.from('activite_archivee').upsert({ profile_id: state.profile.id, cle })
: sb.from('activite_archivee').delete().eq('profile_id', state.profile.id).eq('cle', cle);
const { error } = await q;
if(error) throw error;
}catch(e){ a.archivee = !archiver; render(); toast('Erreur : ' + e.message, 'erreur'); }
}

async function archiverToutActivite(){
const cles = (activite.items || []).filter(a => !a.archivee).map(a => a.cle);
if(!cles.length) return;
(activite.items || []).forEach(a => { if(cles.includes(a.cle)) a.archivee = true; });
render();
try{
const { error } = await sb.from('activite_archivee').upsert(cles.map(cle => ({ profile_id: state.profile.id, cle })));
if(error) throw error;
toast(cles.length > 1 ? cles.length + ' notifications archivées' : 'Notification archivée');
}catch(e){ toast('Erreur : ' + e.message, 'erreur'); chargerActivite(true); }
}

function libelleJour(d){
const j = new Date(d); const auj = new Date();
const hier = new Date(); hier.setDate(auj.getDate() - 1);
if(j.toDateString() === auj.toDateString()) return "Aujourd'hui";
if(j.toDateString() === hier.toDateString()) return 'Hier';
return j.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
}

function viewActivite(){
chargerActivite(false);
const recentes = (activite.items || []).filter(a => !a.archivee);
const archivees = (activite.items || []).filter(a => a.archivee);
const filtre = activite.filtre === 'archivees' ? 'archivees' : 'recentes';
const liste = filtre === 'archivees' ? archivees : recentes;

let corps;
if(activite.error) corps = `<div class="alert alert-info">${esc(activite.error)}</div><button class="btn btn-sm" data-action="activite-rafraichir">Réessayer</button>`;
else if(activite.items === null) corps = squeletteListe(4);
else if(!liste.length) corps = `<div class="card empty"><div class="empty-icone">${iconeNav(filtre === 'archivees' ? 'archive' : 'journal', 30)}</div>
<strong>${filtre === 'archivees' ? 'Aucune notification archivée' : 'Vous êtes à jour'}</strong><br>
<span class="small">${filtre === 'archivees' ? 'Les notifications que vous archivez restent consultables ici pendant une semaine.' : "Aucune nouvelle activité sur votre parc ces 7 derniers jours."}</span></div>`;
else {
let jour = '';
corps = '<div class="card activite-liste">' + liste.map(a => {
const g = GENRES_ACTIVITE[a.genre] || { l:a.genre, ico:'journal', c:'bleu' };
const entete = libelleJour(a.le) !== jour ? `<div class="activite-jour">${esc(jour = libelleJour(a.le))}</div>` : '';
return `${entete}
<div class="activite-ligne">
<div class="activite-ico ${g.c}">${iconeNav(g.ico, 16)}</div>
<div class="activite-corps">
<div class="activite-type">${esc(g.l)} <span class="muted">· ${new Date(a.le).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</span></div>
<div class="activite-titre">${esc(a.titre || '')}</div>
${a.detail ? `<div class="small muted activite-detail">${esc(a.detail)}</div>` : ''}
<div class="activite-actions">
${a.par ? `<span class="small muted">par ${esc(a.par)}</span>` : ''}
${a.equipement_id ? `<button class="btn-lien-petit" data-action="go" data-path="/equip/${a.equipement_id}">Voir la fiche</button>` : ''}
</div>
</div>
<button class="icon-btn activite-archiver" data-action="activite-archiver" data-cle="${esc(a.cle)}" data-archiver="${a.archivee ? '0' : '1'}"
title="${a.archivee ? 'Remettre dans les récentes' : 'Archiver'}" aria-label="${a.archivee ? 'Remettre dans les récentes' : 'Archiver'}">${iconeNav(a.archivee ? 'undo' : 'archive', 17)}</button>
</div>`;
}).join('') + '</div>';
}

return `
<div class="row between wrap" style="margin-bottom:6px;"><h2>Journal</h2>
<button class="btn btn-sm" data-action="activite-rafraichir">Actualiser</button></div>
<div class="reglages-aide">Ce qui s'est passé sur votre parc ces 7 derniers jours. Archivez une notification pour la retirer, retrouvez-la dans « Archivées ». Chaque notification s'efface automatiquement au bout d'une semaine.</div>
<div class="row between wrap" style="margin-bottom:12px;gap:10px;">
<div class="segment">
<button class="${filtre === 'recentes' ? 'active' : ''}" data-action="activite-filtre" data-filtre="recentes">Récentes <span class="onglet-compteur ${recentes.length ? 'alerte' : ''}">${recentes.length}</span></button>
<button class="${filtre === 'archivees' ? 'active' : ''}" data-action="activite-filtre" data-filtre="archivees">Archivées <span class="onglet-compteur">${archivees.length}</span></button>
</div>
${filtre === 'recentes' && recentes.length > 1 ? `<button class="btn btn-sm" data-action="activite-tout-archiver">${iconeNav('archive', 15)} Tout archiver</button>` : ''}
</div>
${corps}`;
}

/* ====================================================================== */
/* Statistiques & export Excel (v2.17.4)                                   */
/* ---------------------------------------------------------------------- */
/* Fondateur : Support → « Statistiques & export », sur un parc simulé     */
/* (démonstration commerciale) ou sur le parc réel d'un client.            */
/* Administrateur et responsable : Support → « Statistiques & export »,    */
/* sur leur propre parc (les droits par type s'appliquent : la base ne     */
/* renvoie que ce que la personne a le droit de voir).                     */
/* Le fichier Excel est fabriqué sur l'appareil, sans bibliothèque externe */
/* ni envoi de données à un tiers. Les photos ne sont pas exportées.       */
/* ====================================================================== */
const STATS_DEMO = 'demo';
let statsState = { source: null, cle: null, data: null, loading: false, error: '', exportEnCours: false };

function peutStats(){ return isSuperAdmin() || ['admin','responsable'].includes(state.profile?.role); }

function sousMenuSupportClient(actif){
return `
<div class="sous-menu" role="tablist">
<button class="${actif === 'demandes' ? 'active' : ''}" data-action="go" data-path="/support">${iconeNav('inbox', 16)} Mes demandes</button>
<button class="${actif === 'stats' ? 'active' : ''}" data-action="go" data-path="/support/stats">${iconeNav('chart', 16)} Statistiques &amp; export</button>
</div>`;
}

/* ---- Parc simulé (toujours identique : générateur à graine fixe) ---- */
function statsAleaFixe(graine){
let a = graine >>> 0;
return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function statsIsoJour(d){ return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

function donneesDemo(){
const alea = statsAleaFixe(972);
const pick = arr => arr[Math.floor(alea() * arr.length)];
const types = [
{ id:'dt1', nom:'Dispositif médical', champs:[{ key:'marque', label:'Marque' }, { key:'service', label:'Service' }] },
{ id:'dt2', nom:'Véhicule', champs:[{ key:'marque', label:'Marque' }, { key:'km', label:'Kilométrage' }] },
{ id:'dt3', nom:'Ascenseur', champs:[{ key:'niveaux', label:'Niveaux desservis' }] },
{ id:'dt4', nom:'Sécurité incendie', champs:[{ key:'emplacement', label:'Emplacement' }] },
{ id:'dt5', nom:'Climatisation', champs:[{ key:'puissance', label:'Puissance' }] },
];
const catalogue = [
['dt1','Pousse-seringue n° 1','PS-2201',{ marque:'Fresenius', service:'Réanimation' }, 7],
['dt1','Pousse-seringue n° 2','PS-2202',{ marque:'Fresenius', service:'Réanimation' }, 5],
['dt1','Pousse-seringue n° 3','PS-2203',{ marque:'B. Braun', service:'Urgences' }, 4],
['dt1','Moniteur multiparamétrique — box 1','MON-114',{ marque:'Philips', service:'Urgences' }, 9],
['dt1','Moniteur multiparamétrique — box 2','MON-115',{ marque:'Philips', service:'Urgences' }, 6],
['dt1','Défibrillateur DAE — hall','DAE-031',{ marque:'Zoll', service:'Accueil' }, 3],
['dt1','Défibrillateur DAE — 2e étage','DAE-032',{ marque:'Zoll', service:'Chirurgie' }, 2],
['dt1','Lit médicalisé ch. 204','LIT-204',{ marque:'Hill-Rom', service:'Médecine' }, 4],
['dt1','Lit médicalisé ch. 211','LIT-211',{ marque:'Hill-Rom', service:'Médecine' }, 6],
['dt1','Autoclave stérilisation','AUT-07',{ marque:'Getinge', service:'Stérilisation' }, 11],
['dt2','Ambulance n° 1','FX-418-MQ',{ marque:'Renault Master', km:'148 200' }, 16],
['dt2','Ambulance n° 2','GA-102-MQ',{ marque:'Renault Master', km:'96 540' }, 12],
['dt2','Véhicule de liaison','GD-775-MQ',{ marque:'Peugeot 208', km:'41 300' }, 5],
['dt3','Ascenseur A — patients','ASC-A',{ niveaux:'RDC à R+4' }, 10],
['dt3','Ascenseur B — visiteurs','ASC-B',{ niveaux:'RDC à R+4' }, 7],
['dt3','Monte-charge cuisine','MC-01',{ niveaux:'SS à RDC' }, 5],
['dt4','Centrale de détection incendie','SSI-01',{ emplacement:'PC sécurité' }, 4],
['dt4','Extincteurs — RDC (lot de 12)','EXT-RDC',{ emplacement:'Rez-de-chaussée' }, 2],
['dt4','Extincteurs — étages (lot de 20)','EXT-ETG',{ emplacement:'R+1 à R+4' }, 2],
['dt4','Désenfumage — cage d\'escalier','DES-01',{ emplacement:'Escalier nord' }, 2],
['dt5','Centrale de traitement d\'air — bloc','CTA-BLOC',{ puissance:'45 kW' }, 9],
['dt5','Climatiseur salle serveurs','CLIM-SRV',{ puissance:'7 kW' }, 6],
['dt5','Climatiseurs chambres (lot de 30)','CLIM-CH',{ puissance:'2,5 kW / unité' }, 8],
];
const actes = {
dt1:['Maintenance préventive','Contrôle qualité','Étalonnage','Réparation','Remplacement de pièce'],
dt2:['Révision','Vidange','Pneumatiques','Contrôle technique','Réparation carrosserie'],
dt3:['Visite de maintenance','Dépannage','Contrôle réglementaire'],
dt4:['Vérification annuelle','Contrôle périodique','Remplacement'],
dt5:['Nettoyage des filtres','Maintenance préventive','Recharge de gaz','Dépannage'],
};
const notes = ['RAS, équipement conforme.','Pièce d\'usure remplacée, essais concluants.','Anomalie corrigée, remise en service.','Contrôle effectué, rapport joint en photo.','Réglages effectués selon la notice constructeur.','Dégâts constatés, devis transmis à la direction.'];
const intervenants = { dt1:['Julien','Karine','Julien'], dt2:['Steeve','Garage partenaire'], dt3:['Prestataire ascenseurs'], dt4:['Prestataire incendie','Karine'], dt5:['Steeve','Julien'] };
const auj = new Date(); auj.setHours(12, 0, 0, 0);
const equipements = [], interventions = [];
catalogue.forEach(([type_id, nom, serie, valeurs, poids], i) => {
const cree = new Date(auj); cree.setDate(cree.getDate() - 400 - Math.floor(alea() * 200));
const e = { id:'demo-e' + i, type_id, nom, serial_value:serie, valeurs, archived:false, created_at:cree.toISOString() };
equipements.push(e);
const n = Math.max(1, Math.round(poids * (0.8 + alea() * 0.6)));
for(let k = 0; k < n; k++){
const d = new Date(auj); d.setDate(d.getDate() - Math.floor(Math.pow(alea(), 0.9) * 360));
interventions.push({ id:'demo-i' + i + '-' + k, equipement_id:e.id, date:statsIsoJour(d), type:pick(actes[type_id]),
technicien:pick(intervenants[type_id]), description:pick(notes), photos:Array(Math.floor(alea() * 3)).fill('x') });
}
});
equipements.push({ id:'demo-e99', type_id:'dt1', nom:'Pompe à perfusion ancienne génération', serial_value:'PP-0098', valeurs:{ marque:'Ivac', service:'Médecine' }, archived:true, archive_reason:'Réformée — remplacée par PS-2203', created_at:'2023-03-01T10:00:00Z' });
return { demo:true, client:'Clinique Les Flamboyants (démonstration)', types, equipements, interventions };
}

/* ---- Chargement du parc réel ---- */
async function chargerStats(orgId){
const { data:types, error:e1 } = await sb.from('equipment_types').select('id, nom, champs').eq('organization_id', orgId);
if(e1) throw e1;
const { data:eqs, error:e2 } = await sb.from('equipements')
.select('id, nom, type_id, serial_value, valeurs, archived, archive_reason, archived_at, created_at').eq('organization_id', orgId);
if(e2) throw e2;
const ids = (eqs || []).map(e => e.id), interventions = [];
for(let i = 0; i < ids.length; i += 150){
const lot = ids.slice(i, i + 150);
for(let debut = 0; ; debut += 1000){
const { data, error } = await sb.from('interventions')
.select('id, equipement_id, date, type, technicien, description, photos, modifie_le, modifie_par')
.in('equipement_id', lot).order('date', { ascending:false }).range(debut, debut + 999);
if(error) throw error;
interventions.push(...(data || []));
if(!data || data.length < 1000) break;
}
}
const client = isSuperAdmin() ? nomClientDe(orgId) : (state.orgName || 'Mon établissement');
return { demo:false, orgId, client, types: types || [], equipements: eqs || [], interventions };
}

function statsSourceCourante(){
if(!isSuperAdmin()) return state.profile?.organization_id;
return statsState.source || STATS_DEMO;
}
/* La clé inclut le compte : changer de compte sur l'appareil ne montre jamais les chiffres du précédent. */
function statsCle(){ return (state.profile?.id || '') + ':' + statsSourceCourante(); }

function assurerStats(){
const src = statsSourceCourante(), cle = statsCle();
if(statsState.cle === cle && (statsState.data || statsState.loading || statsState.error)) return;
statsState = { ...statsState, cle, data: null, error: '', loading: true };
if(src === STATS_DEMO){ statsState.data = donneesDemo(); statsState.loading = false; return; }
if(!navigator.onLine){ statsState.loading = false; statsState.error = 'Connexion nécessaire pour calculer les statistiques du parc.'; return; }
chargerStats(src)
.then(d => { if(statsState.cle === cle){ statsState.data = d; statsState.loading = false; render(); } })
.catch(e => { if(statsState.cle === cle){ statsState.loading = false; statsState.error = 'Chargement impossible : ' + (e.message || e); render(); } });
}

/* ---- Calculs ---- */
const MOIS_COURTS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function calculerStats(d){
const typeNom = id => (d.types.find(t => t.id === id) || {}).nom || 'Sans type';
const parEq = new Map(d.equipements.map(e => [e.id, { e, n:0, derniere:null, photos:0 }]));
d.interventions.forEach(iv => {
const x = parEq.get(iv.equipement_id); if(!x) return;
x.n++; x.photos += (iv.photos || []).length;
if(!x.derniere || iv.date > x.derniere) x.derniere = iv.date;
});
const lignes = [...parEq.values()].map(x => ({ ...x, type: typeNom(x.e.type_id) }))
.sort((a, b) => b.n - a.n || a.e.nom.localeCompare(b.e.nom, 'fr'));
const auj = new Date(), mois = [];
for(let k = 11; k >= 0; k--){ const m = new Date(auj.getFullYear(), auj.getMonth() - k, 1); mois.push({ cle: m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'), lib: MOIS_COURTS[m.getMonth()], annee: m.getFullYear(), n: 0 }); }
d.interventions.forEach(iv => { const m = mois.find(x => x.cle === String(iv.date || '').slice(0, 7)); if(m) m.n++; });
const parType = new Map();
lignes.forEach(l => { const t = parType.get(l.type) || { nom: l.type, eq: 0, n: 0 }; if(!l.e.archived) t.eq++; t.n += l.n; parType.set(l.type, t); });
const il30 = statsIsoJour(new Date(Date.now() - 30 * 86400000));
const enService = d.equipements.filter(e => !e.archived).length;
return {
lignes, mois, types: [...parType.values()].sort((a, b) => b.n - a.n),
enService, archives: d.equipements.length - enService, total: d.interventions.length,
recents: d.interventions.filter(iv => (iv.date || '') >= il30).length,
moyenne: enService ? d.interventions.length / enService : 0,
};
}

/* ---- Graphiques (une seule teinte : la couleur du rôle) ---- */
function statsBarresMois(mois){
const max = Math.max(1, ...mois.map(m => m.n));
const pas = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
const haut = Math.ceil(max / pas) * pas;
const etroit = window.innerWidth < 640, W = etroit ? 340 : 600, H = etroit ? 180 : 200, g = etroit ? 26 : 34, b = 26, largeur = (W - g - 6) / mois.length;
const y = v => 8 + (H - b - 8) * (1 - v / haut);
let grille = '';
for(let v = 0; v <= haut; v += pas) grille += `<line x1="${g}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" class="st-grille"/><text x="${g - 6}" y="${y(v) + 4}" class="st-axe" text-anchor="end">${v}</text>`;
const barres = mois.map((m, i) => {
const x = g + i * largeur + largeur * 0.18, w = largeur * 0.64, h = Math.max(0, y(0) - y(m.n));
return `<g class="st-barre"><rect x="${g + i * largeur}" y="8" width="${largeur}" height="${H - b - 8}" fill="transparent"/>
${m.n ? `<path d="M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z" class="st-fill"/>` : ''}
<text x="${x + w / 2}" y="${H - 8}" class="st-axe" text-anchor="middle">${etroit ? m.lib.slice(0, 1).toUpperCase() : m.lib}</text>
<title>${m.lib} ${m.annee} : ${m.n} intervention${m.n > 1 ? 's' : ''}</title></g>`;
}).join('');
return `<svg viewBox="0 0 ${W} ${H}" class="st-svg" role="img" aria-label="Interventions par mois sur 12 mois">${grille}${barres}</svg>`;
}

function statsListeBarres(items, lib, val, sousLib){
if(!items.length || !items.some(val)) return `<div class="small muted" style="padding:10px 0;">Aucune intervention enregistrée pour l'instant.</div>`;
const max = Math.max(1, ...items.map(val));
return `<div class="st-liste">${items.map(it => `
<div class="st-ligne" title="${esc(lib(it))} : ${val(it)} intervention${val(it) > 1 ? 's' : ''}">
<div class="st-nom"><span>${esc(lib(it))}</span>${sousLib ? `<small>${esc(sousLib(it))}</small>` : ''}</div>
<div class="st-piste"><div class="st-jauge" style="width:${Math.max(2, 100 * val(it) / max)}%"></div></div>
<div class="st-val">${val(it)}</div>
</div>`).join('')}</div>`;
}

/* ---- Vue ---- */
function viewStats(){
if(!peutStats()) return viewNonAutorise();
if(isSuperAdmin()) chargerClients(false);
assurerStats();
const s = statsState, d = s.data;
const clients = isSuperAdmin() ? [...(reglages.clients || [])].filter(c => !c.est_mon_organisation).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) : [];
const src = statsSourceCourante();
const entete = `
<div class="row between wrap st-entete">
<div>
<h2 style="margin:0;">Statistiques &amp; export</h2>
<div class="small muted">${d ? esc(d.client) : ''}</div>
</div>
<div class="row wrap" style="gap:8px;">
${isSuperAdmin() ? `<label class="st-source"><span>Parc</span>
<select data-action="stats-source">
<option value="${STATS_DEMO}" ${src === STATS_DEMO ? 'selected' : ''}>Démonstration — parc simulé</option>
${clients.map(c => `<option value="${c.id}" ${src === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
</select></label>` : ''}
<button class="btn btn-primary" data-action="stats-export" ${!d || s.exportEnCours ? 'disabled' : ''}>${iconeNav('download', 16)} ${s.exportEnCours ? 'Préparation…' : 'Exporter en Excel'}</button>
</div>
</div>
${d && d.demo ? `<div class="alert alert-info st-demo">${iconeNav('chart', 16)} <span><b>Données simulées</b> pour la démonstration : un établissement fictif, ses ${d.equipements.length} équipements et ${d.interventions.length} interventions sur 12 mois. L'export Excel fonctionne comme pour un vrai client.</span></div>` : ''}`;
if(s.loading) return entete + `<div class="center-screen" style="min-height:30vh;"><div class="spinner"></div></div>`;
if(s.error) return entete + `<div class="alert alert-error">${esc(s.error)}</div><button class="btn" data-action="stats-recharger">Réessayer</button>`;
if(!d) return entete;
const c = calculerStats(d);
if(!d.equipements.length) return entete + `<div class="empty">Aucun équipement dans ce parc pour l'instant.</div>`;
const fmt1 = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const lienEq = l => d.demo ? esc(l.e.nom) : `<a href="#/equip/${l.e.id}">${esc(l.e.nom)}</a>`;
return entete + `
<div class="st-kpis">
<div class="st-kpi"><div class="v">${c.enService}</div><div class="l">équipements en service${c.archives ? ` <span class="muted">(+${c.archives} archivé${c.archives > 1 ? 's' : ''})</span>` : ''}</div></div>
<div class="st-kpi"><div class="v">${c.total}</div><div class="l">interventions enregistrées</div></div>
<div class="st-kpi"><div class="v">${fmt1(c.moyenne)}</div><div class="l">interventions par équipement</div></div>
<div class="st-kpi"><div class="v">${c.recents}</div><div class="l">ces 30 derniers jours</div></div>
</div>
<div class="card"><h3>Interventions par mois</h3>${c.mois.some(m => m.n) ? `<div class="small muted" style="margin-bottom:6px;">12 derniers mois — survolez ou touchez une barre pour le détail.</div>${statsBarresMois(c.mois)}` : `<div class="small muted" style="padding:10px 0;">Aucune intervention sur les 12 derniers mois.</div>`}</div>
<div class="st-deux">
<div class="card"><h3>Équipements les plus sollicités</h3>${statsListeBarres(c.lignes.filter(l => l.n).slice(0, 10), l => l.e.nom, l => l.n, l => l.type)}</div>
<div class="card"><h3>Par type d'équipement</h3>${statsListeBarres(c.types, t => t.nom, t => t.n, t => t.eq + ' équipement' + (t.eq > 1 ? 's' : ''))}</div>
</div>
<div class="card">
<h3>Tous les équipements <span class="muted small">(${c.lignes.length})</span></h3>
<div class="st-table-wrap"><table class="st-table">
<thead><tr><th>Équipement</th><th>Type</th><th class="num">Interventions</th><th>Dernière</th></tr></thead>
<tbody>${c.lignes.map(l => `<tr class="${l.e.archived ? 'st-archive' : ''}"><td>${lienEq(l)}${l.e.serial_value ? `<div class="small muted">${esc(l.e.serial_value)}</div>` : ''}<div class="small muted st-type-mob">${esc(l.type)}</div>${l.e.archived ? ' <span class="badge badge-off">archivé</span>' : ''}</td><td>${esc(l.type)}</td><td class="num"><b>${l.n}</b></td><td>${l.derniere ? fmtDate(l.derniere) : '—'}</td></tr>`).join('')}</tbody>
</table></div>
<div class="small muted" style="margin-top:8px;">L'export Excel contient 3 onglets : Synthèse, Équipements (avec le nombre d'interventions de chacun) et Interventions (tout l'historique). Les photos restent dans l'application.</div>
</div>`;
}

/* ---- Fichier Excel (.xlsx) fait maison : XML + ZIP sans compression ---- */
const XL_CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function xlCrc(u8){ let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = XL_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function xlZip(fichiers){
const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
for(const [nom, contenu] of fichiers){
const n = enc.encode(nom), data = enc.encode(contenu), crc = xlCrc(data);
const h = new DataView(new ArrayBuffer(30));
h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
parts.push(new Uint8Array(h.buffer), n, data);
const c = new DataView(new ArrayBuffer(46));
c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
central.push(new Uint8Array(c.buffer), n);
offset += 30 + n.length + data.length;
}
const tailleCentral = central.reduce((s, p) => s + p.length, 0);
const fin = new DataView(new ArrayBuffer(22));
fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
fin.setUint32(12, tailleCentral, true); fin.setUint32(16, offset, true);
return new Blob([...parts, ...central, new Uint8Array(fin.buffer)], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function xlEsc(v){ return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
function xlCol(i){ let s = ''; i++; while(i){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function xlJour(iso){ const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; }
/* Styles : 0 normal · 1 en-tête · 2 date · 3 titre · 4 sous-titre · 5 gras · 6 texte long */
function xlFeuille(f){
const lignes = f.lignes.map((ligne, r) => {
if(!ligne) return '';
const cells = ligne.map((v, c) => {
if(v === null || v === undefined || v === '') return '';
const ref = xlCol(c) + (r + 1);
const cell = typeof v === 'object' ? v : { v };
const st = cell.s ? ` s="${cell.s}"` : '';
if(cell.date) return `<c r="${ref}" s="2"><v>${xlJour(cell.date)}</v></c>`;
if(typeof cell.v === 'number') return `<c r="${ref}"${st}><v>${cell.v}</v></c>`;
return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xlEsc(cell.v)}</t></is></c>`;
}).join('');
return `<row r="${r + 1}"${f.hauteurs && f.hauteurs[r] ? ` ht="${f.hauteurs[r]}" customHeight="1"` : ''}>${cells}</row>`;
}).join('');
const gel = f.gel ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${f.gel}" topLeftCell="A${f.gel + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
const cols = `<cols>${f.largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
const filtre = f.filtre ? `<autoFilter ref="${f.filtre}"/>` : '';
return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${gel}${cols}<sheetData>${lignes}</sheetData>${filtre}<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function xlClasseur(feuilles){
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="15"/><color rgb="FF0B4A42"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF5B686D"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const fichiers = [
['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${xlEsc(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${feuilles.some(f => f.filtre) ? '<definedNames>' : ''}${feuilles.map((f, i) => f.filtre ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xlEsc(f.nom)}'!${f.filtre.split(':').map(p => p.replace(/([A-Z]+)(\d+)/, '$$$1$$$2')).join(':')}</definedName>` : '').join('')}${feuilles.some(f => f.filtre) ? '</definedNames>' : ''}</workbook>`],
['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
['xl/styles.xml', styles],
...feuilles.map((f, i) => [`xl/worksheets/sheet${i + 1}.xml`, xlFeuille(f)]),
];
return xlZip(fichiers);
}

function construireExport(d){
const c = calculerStats(d);
const eqParId = new Map(d.equipements.map(e => [e.id, e]));
const typeDe = id => d.types.find(t => t.id === id) || { nom:'Sans type', champs:[] };
const caracteristiques = e => {
const t = typeDe(e.type_id), v = e.valeurs || {};
return (t.champs || []).filter(ch => v[ch.key] !== undefined && v[ch.key] !== null && v[ch.key] !== '').map(ch => `${ch.label} : ${v[ch.key]}`).join(' · ');
};
const aujourd = statsIsoJour(new Date()), auteur = state.profile?.full_name || '';
const H = v => ({ v, s:1 });
const synthese = [
[{ v:'WiTracEQUIP — ' + d.client, s:3 }],
[{ v:`Export du ${fmtDate(aujourd)}${auteur ? ' par ' + auteur : ''}${d.demo ? ' — données simulées pour la démonstration' : ''}`, s:4 }],
null,
[H('Indicateur'), H('Valeur')],
['Équipements en service', c.enService],
['Équipements archivés', c.archives],
['Interventions enregistrées', c.total],
['Interventions par équipement (moyenne)', Math.round(c.moyenne * 10) / 10],
['Interventions ces 30 derniers jours', c.recents],
null,
[H("Type d'équipement"), H('Équipements en service'), H('Interventions')],
...c.types.map(t => [t.nom, t.eq, t.n]),
null,
[H('Mois'), H('Interventions')],
...c.mois.map(m => [`${m.lib} ${m.annee}`, m.n]),
null,
[H('Top 10 — équipements les plus sollicités'), H('Type'), H('Interventions')],
...c.lignes.filter(l => l.n).slice(0, 10).map(l => [l.e.nom, l.type, l.n]),
];
const lignesEq = [
[H('Équipement'), H('Type'), H('N° de série / immatriculation'), H('Statut'), H("Nombre d'interventions"), H('Dernière intervention'), H('Photos'), H('Caractéristiques'), H('Créé le'), H("Motif d'archivage")],
...c.lignes.map(l => [l.e.nom, l.type, l.e.serial_value || '', l.e.archived ? 'Archivé' : 'En service', l.n, l.derniere ? { date:l.derniere } : '', l.photos, { v:caracteristiques(l.e), s:6 }, l.e.created_at ? { date:l.e.created_at } : '', l.e.archive_reason || '']),
];
const ivs = [...d.interventions].sort((a, b) => String(b.date).localeCompare(String(a.date)));
const lignesIv = [
[H('Date'), H('Équipement'), H("Type d'équipement"), H('N° de série / immatriculation'), H('Intervention'), H('Intervenant'), H('Description'), H('Photos'), H('Modifiée le'), H('Modifiée par')],
...ivs.map(iv => { const e = eqParId.get(iv.equipement_id) || {}; return [iv.date ? { date:iv.date } : '', e.nom || '', typeDe(e.type_id).nom, e.serial_value || '', iv.type || '', iv.technicien || '', { v:iv.description || '', s:6 }, (iv.photos || []).length, iv.modifie_le ? { date:iv.modifie_le } : '', iv.modifie_par || '']; }),
];
return xlClasseur([
{ nom:'Synthèse', lignes:synthese, largeurs:[46, 24, 16], hauteurs:{ 0:22, 3:18 } },
{ nom:'Équipements', lignes:lignesEq, largeurs:[38, 22, 24, 12, 14, 16, 9, 50, 12, 30], gel:1, filtre:`A1:J${lignesEq.length}`, hauteurs:{ 0:30 } },
{ nom:'Interventions', lignes:lignesIv, largeurs:[12, 36, 22, 24, 26, 20, 60, 9, 12, 18], gel:1, filtre:`A1:J${lignesIv.length}`, hauteurs:{ 0:30 } },
]);
}

async function actionExporterStats(){
const d = statsState.data;
if(!d || statsState.exportEnCours) return;
statsState.exportEnCours = true; render();
try{
const blob = construireExport(d);
const nomFichier = ('WiTracEQUIP_' + d.client.replace(/\(démonstration\)/, 'demo') + '_' + statsIsoJour(new Date()))
.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_') + '.xlsx';
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = nomFichier; document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(url), 60000);
if(!d.demo) sb.rpc('noter_export', { p_org: d.orgId, p_nb_equipements: d.equipements.length, p_nb_interventions: d.interventions.length }).then(() => { reglages.journal = null; }, () => {});
toast('Fichier Excel prêt : ' + nomFichier);
}catch(e){ toast('Export impossible : ' + (e.message || e), 'erreur'); }
finally{ statsState.exportEnCours = false; render(); }
}

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
if(t.dataset.action === 'stats-export') actionExporterStats();
else if(t.dataset.action === 'stats-recharger'){ statsState.cle = null; render(); }
});
document.addEventListener('change', (e) => {
const t = e.target;
if(t && t.dataset && t.dataset.action === 'stats-source'){ statsState.source = t.value; statsState.cle = null; render(); }
});
