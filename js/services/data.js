/* Data layer */
/* ---------------------------------------------------------------------- */

async function loadProfileAndOrg(){
const uid = state.session.user.id;
const { data: profile, error } = await sb.from('profiles').select('id, organization_id, full_name, role, active').eq('id', uid).maybeSingle();
if(error) throw error;
if(!profile){
// Le trigger d'inscription n'a pas encore tourné (rare / latence) — on réessaie une fois.
await new Promise(r=>setTimeout(r, 800));
const retry = await sb.from('profiles').select('id, organization_id, full_name, role, active').eq('id', uid).maybeSingle();
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
const { data, error } = await sb.from('equipment_types').select('id, nom, champs, created_at').order('nom');
if(error) throw error;
state.types = data || [];
state.typesLoaded = true;
return state.types;
}

async function listEquipements({ search, typeId, showArchived }){
let q = sb.from('equipements').select('id, nom, serial_value, valeurs, archived, type_id, created_at').order('created_at', {ascending:false});
if(!showArchived) q = q.eq('archived', false);
if(typeId) q = q.eq('type_id', typeId);
if(search) q = q.ilike('nom', `%${search}%`);
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
.select('id, full_name, role, active, acces_tous_types, fondateur, created_at').order('created_at');
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
.select('*').is('used_at', null).order('created_at', {ascending:false});
if(error) throw error;
const now = Date.now();
return (data || []).filter(i => new Date(i.expires_at).getTime() > now);
}

async function createInvite(role, label, accesTousTypes, typesAutorises){
const { data, error } = await sb.from('invites')
.insert({
organization_id: state.profile.organization_id,
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
if(btn){
const avant = btn.textContent;
btn.textContent = 'Copié !';
setTimeout(()=>{ btn.textContent = avant; }, 1600);
}
}

/* ---------------------------------------------------------------------- */
