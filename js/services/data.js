/* Data layer */
/* ---------------------------------------------------------------------- */

async function loadProfileAndOrg(){
const uid = state.session.user.id;
const { data: profile, error } = await sb.from('profiles').select('id, organization_id, full_name, role, active, fondateur').eq('id', uid).maybeSingle();
if(error) throw error;
if(!profile){
// Le trigger d'inscription n'a pas encore tourné (rare / latence) — on réessaie une fois.
await new Promise(r=>setTimeout(r, 800));
const retry = await sb.from('profiles').select('id, organization_id, full_name, role, active, fondateur').eq('id', uid).maybeSingle();
// Profil invisible malgré une session valide = accès coupé côté base
// (profil suspendu ou organisation suspendue : current_org_id() renvoie NULL).
if(retry.error || !retry.data) throw new Error('ACCES_SUSPENDU');
state.profile = retry.data;
} else {
state.profile = profile;
}
const { data: org } = await sb.from('organizations').select('nom').eq('id', state.profile.organization_id).maybeSingle();
state.orgName = org?.nom || '';
}

async function loadTypes(force){
if(state.typesLoaded && !force) return state.types;
// Filtre explicite sur l'organisation : le super-admin plateforme peut lire les
// types de TOUS ses clients (pour régler leurs invitations), mais son propre
// parc ne doit afficher que les siens.
const { data, error } = await sb.from('equipment_types').select('id, nom, champs, created_at')
.eq('organization_id', state.profile.organization_id).order('nom');
if(error) throw error;
state.types = data || [];
state.typesLoaded = true;
return state.types;
}

async function listEquipements({ search, typeId, showArchived }){
let q = sb.from('equipements').select('id, nom, serial_value, valeurs, archived, type_id, created_at').order('created_at', {ascending:false});
if(!showArchived) q = q.eq('archived', false);
if(typeId) q = q.eq('type_id', typeId);
// Recherche par nom OU par n° de série / immatriculation.
// Les caractères qui ont un sens dans la syntaxe de filtre sont retirés.
if(search){
const motif = String(search).replace(/[,()"*%\\]/g, ' ').trim();
if(motif) q = q.or(`nom.ilike.*${motif}*,serial_value.ilike.*${motif}*`);
}
const { data, error } = await q;
if(error) throw error;
return data || [];
}

async function getEquipement(id){
const { data, error } = await sb.from('equipements').select('*').eq('id', id).maybeSingle();
if(error) throw error;
return data;
}

async function listInterventions(equipementId){
const { data, error } = await sb.from('interventions').select('*').eq('equipement_id', equipementId).order('date', {ascending:false});
if(error) throw error;
return data || [];
}

/* --- Gestion des profils (admin uniquement) ------------------------- */

async function listMembers(){
const { data, error } = await sb.from('profiles')
.select('id, organization_id, full_name, role, active, acces_tous_types, fondateur, created_at, organizations(nom, code_client, active)')
.order('created_at');
if(error) throw error;
return data || [];
}

/* Cloisonnement par métier : quels types chaque profil a le droit de voir. */
async function listAcces(){
const { data, error } = await sb.from('acces_types').select('profile_id, type_id');
if(error) throw error;
return data || [];
}

async function setAccesTousTypes(id, valeur){
const { error } = await sb.from('profiles').update({ acces_tous_types: valeur }).eq('id', id);
if(error) throw error;
}

async function setAccesType(profileId, typeId, autoriser){
if(autoriser){
const { error } = await sb.from('acces_types').insert({ profile_id: profileId, type_id: typeId });
if(error) throw error;
} else {
const { error } = await sb.from('acces_types').delete()
.eq('profile_id', profileId).eq('type_id', typeId);
if(error) throw error;
}
}

async function listInvites(){
const { data, error } = await sb.from('invites')
.select('*, organizations(nom, code_client)').is('used_at', null).order('created_at', {ascending:false});
if(error) throw error;
const now = Date.now();
return (data || []).filter(i => new Date(i.expires_at).getTime() > now);
}

async function createInvite(organizationId, role, label, accesTousTypes, typesAutorises){
const { data, error } = await sb.from('invites')
.insert({
organization_id: organizationId || state.profile.organization_id,
role,
label: label || null,
acces_tous_types: accesTousTypes,
types_autorises: accesTousTypes ? [] : typesAutorises,
})
.select().single();
if(error) throw error;
return data;
}

async function cancelInvite(id){
const { error } = await sb.from('invites').delete().eq('id', id);
if(error) throw error;
}

async function setMemberRole(id, role){
const { error } = await sb.from('profiles').update({ role }).eq('id', id);
if(error) throw error;
}

async function setMemberActive(id, active){
const { error } = await sb.from('profiles').update({ active }).eq('id', id);
if(error) throw error;
}

/* --- Réglages : clients, journal, support ---------------------------- */

async function chargerStatutSuperAdmin(){
const { data, error } = await sb.rpc('is_super_admin');
state.superAdmin = !error && data === true;
}

async function listClients(){
const { data, error } = await sb.rpc('liste_clients');
if(error) throw error;
return data || [];
}

/* Types d'un modèle métier, au format stocké en base (clé de champ incluse). */
function typesDuModele(cle){
const m = MODELES_METIERS.find(x => x.cle === cle);
if(!m) return null;
return m.types.map(t => ({ nom: t.nom, champs: t.champs.map(c => ({ key: slugify(c.label), label: c.label, type: c.type })) }));
}

async function creerClient(f){
const { data, error } = await sb.rpc('creer_client', {
p_nom: f.nom, p_adresse: f.adresse, p_telephone: f.telephone, p_email: f.email,
p_referent: f.referent, p_notes: f.notes, p_modele: f.modele || null, p_types: typesDuModele(f.modele),
});
if(error) throw error;
return data;
}

async function modifierClient(id, f){
const { data, error } = await sb.rpc('modifier_client', {
p_id: id, p_nom: f.nom, p_adresse: f.adresse, p_telephone: f.telephone, p_email: f.email,
p_referent: f.referent, p_notes: f.notes, p_modele: f.modele || null, p_types: typesDuModele(f.modele),
});
if(error) throw error;
return data;
}

async function definirStatutClients(ids, actif){
const { data, error } = await sb.rpc('definir_statut_clients', { p_ids: ids, p_actif: actif });
if(error) throw error;
return data;
}

async function supprimerClients(ids){
const { data, error } = await sb.rpc('supprimer_clients', { p_ids: ids });
if(error) throw error;
return data;
}

/* Types d'équipement d'une organisation donnée (super-admin : n'importe laquelle). */
async function listTypesOrg(orgId){
const { data, error } = await sb.from('equipment_types').select('id, nom, organization_id')
.eq('organization_id', orgId).order('nom');
if(error) throw error;
return data || [];
}

async function listTypesToutesOrgs(){
const { data, error } = await sb.from('equipment_types').select('id, nom, organization_id').order('nom');
if(error) throw error;
return data || [];
}

async function listEmailsMembres(){
const { data, error } = await sb.rpc('emails_membres');
if(error) return [];
return data || [];
}

async function supprimerProfils(ids){
const { data, error } = await sb.rpc('supprimer_profils', { p_ids: ids });
if(error) throw error;
return data;
}

async function setMembresActive(ids, active){
const { error } = await sb.from('profiles').update({ active }).in('id', ids);
if(error) throw error;
}

async function listJournal(){
const { data, error } = await sb.from('journal').select('*').order('le', { ascending:false }).limit(300);
if(error) throw error;
return data || [];
}

async function listDemandesSupport(){
const { data, error } = await sb.from('demandes_support').select('*').order('created_at', { ascending:false }).limit(200);
if(error) throw error;
return data || [];
}

async function setStatutDemande(id, statut){
const { error } = await sb.from('demandes_support')
.update({ statut, traite_le: statut === 'traite' ? new Date().toISOString() : null }).eq('id', id);
if(error) throw error;
}

/* Renvoie une erreur claire si la base a refusé (aucune ligne modifiée). */
async function renommerMembre(id, nom){
const { data, error } = await sb.from('profiles').update({ full_name: nom }).eq('id', id).select('id');
if(error) throw error;
if(!data || !data.length) throw new Error("Vous n'avez pas le droit de modifier ce profil.");
}

async function supprimerDemandeSupport(id){
const { error } = await sb.from('demandes_support').delete().eq('id', id);
if(error) throw error;
}

/* Base de toutes les adresses fabriquées par l'appli (QR codes, invitations). */
function baseUrl(){
const b = (APP_BASE_URL || '').trim();
return b ? b.replace(/\/+$/, '') + '/' : (location.origin + location.pathname);
}
function adresseDefinitive(){ return !!(APP_BASE_URL || '').trim(); }
function lienEquipement(id){ return baseUrl() + '#/equip/' + id; }
/* Adresse portee par le QR code : consultable par n'importe qui, en lecture seule. */
function lienPublic(token){ return baseUrl() + '#/p/' + token; }
function inviteUrl(token){ return baseUrl() + '#/join/' + token; }

async function copierDansPressePapier(texte, btn){
try{
await navigator.clipboard.writeText(texte);
}catch(e){
const ta = document.createElement('textarea');
ta.value = texte; document.body.appendChild(ta); ta.select();
try{ document.execCommand('copy'); }catch(_){}
document.body.removeChild(ta);
}
toast('Lien copié dans le presse-papiers');
if(btn){
const avant = btn.textContent;
btn.textContent = 'Copié !';
setTimeout(()=>{ btn.textContent = avant; }, 1600);
}
}

/* ---------------------------------------------------------------------- */
