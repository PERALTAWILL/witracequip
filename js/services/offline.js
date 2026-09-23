/* Hors-ligne : file d'attente des interventions                          */
/* ---------------------------------------------------------------------- */
/* Une intervention saisie sans réseau est stockée dans IndexedDB, puis
envoyée à Supabase dès que la connexion revient. Rien n'est mis en cache
ici : c'est un stockage local DE BROUILLONS EN ATTENTE D'ENVOI, pas un
cache de données serveur — sw.js continue de ne jamais mettre en cache les
requêtes Supabase (voir son en-tête), ce module ne change rien à ça.

v2.16.7 : un ÉQUIPEMENT créé sans réseau est lui aussi mis en attente
(store « equipements_en_attente »). Son identifiant et son lien QR sont créés
sur le téléphone : l'étiquette peut être imprimée et des interventions
ajoutées avant même l'envoi. À la reconnexion, les équipements partent
AVANT les interventions (une intervention a besoin de son équipement). */

const OFFLINE_DB_NOM = 'wte-offline';
const OFFLINE_DB_VERSION = 2;
const OFFLINE_STORE = 'interventions_en_attente';
const OFFLINE_STORE_EQ = 'equipements_en_attente';

function offlineOuvrirDB(){
return new Promise((resolve, reject) => {
const req = indexedDB.open(OFFLINE_DB_NOM, OFFLINE_DB_VERSION);
req.onupgradeneeded = () => {
const db = req.result;
if(!db.objectStoreNames.contains(OFFLINE_STORE)){
const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
store.createIndex('equipement_id', 'equipement_id', { unique: false });
}
if(!db.objectStoreNames.contains(OFFLINE_STORE_EQ)){
db.createObjectStore(OFFLINE_STORE_EQ, { keyPath: 'id' });
}
};
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}

async function offlineTx(mode, fn, nomStore){
const db = await offlineOuvrirDB();
const n = nomStore || OFFLINE_STORE;
return new Promise((resolve, reject) => {
const transaction = db.transaction(n, mode);
const store = transaction.objectStore(n);
const resultat = fn(store);
transaction.oncomplete = () => resolve(resultat);
transaction.onerror = () => reject(transaction.error);
});
}

async function offlineMettreEnAttente(donnees){
const item = {
id: uuid(),
equipement_id: donnees.equipement_id,
date: donnees.date,
type: donnees.type,
technicien: donnees.technicien,
description: donnees.description || null,
cree_le: new Date().toISOString(),
tentatives: 0,
derniere_erreur: '',
};
await offlineTx('readwrite', (store) => store.add(item));
return item;
}

async function offlineListerEnAttente(equipementId){
return offlineTx('readonly', (store) => new Promise((resolve, reject) => {
const resultats = [];
const index = store.index('equipement_id');
const curseur = equipementId ? index.openCursor(IDBKeyRange.only(equipementId)) : store.openCursor();
curseur.onsuccess = (e) => {
const c = e.target.result;
if(c){ resultats.push(c.value); c.continue(); }
else resolve(resultats);
};
curseur.onerror = () => reject(curseur.error);
}));
}

function offlineCompterStore(nomStore){
return offlineTx('readonly', (store) => new Promise((resolve, reject) => {
const req = store.count();
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
}), nomStore);
}

/* Total affiché dans l'en-tête : interventions + équipements en attente. */
async function offlineCompterEnAttente(){
const [a, b] = await Promise.all([offlineCompterStore(OFFLINE_STORE), offlineCompterStore(OFFLINE_STORE_EQ)]);
return a + b;
}

/* --- Équipements créés sans réseau ---------------------------------- */
async function offlineEquipMettreEnAttente(donnees){
const item = { ...donnees, cree_le: new Date().toISOString(), tentatives: 0, derniere_erreur: '' };
await offlineTx('readwrite', (store) => store.add(item), OFFLINE_STORE_EQ);
return item;
}

async function offlineEquipLister(){
return offlineTx('readonly', (store) => new Promise((resolve, reject) => {
const req = store.getAll();
req.onsuccess = () => resolve(req.result || []);
req.onerror = () => reject(req.error);
}), OFFLINE_STORE_EQ);
}

async function offlineEquipSupprimer(id){
return offlineTx('readwrite', (store) => store.delete(id), OFFLINE_STORE_EQ);
}

async function offlineEquipMarquerEchec(id, message){
return offlineTx('readwrite', (store) => new Promise((resolve, reject) => {
const req = store.get(id);
req.onsuccess = () => {
const item = req.result;
if(!item) return resolve();
item.tentatives += 1; item.derniere_erreur = message;
store.put(item); resolve();
};
req.onerror = () => reject(req.error);
}), OFFLINE_STORE_EQ);
}

/* Équipements en attente, au format d'une ligne de la liste (pour les afficher). */
async function offlineEquipCommeLignes(){
try{
return (await offlineEquipLister()).map(e => ({
id: e.id, organization_id: e.organization_id, type_id: e.type_id, nom: e.nom,
serial_value: e.serial_value, valeurs: e.valeurs || {}, archived: false,
created_at: e.cree_le, public_token: e.public_token, partage_public: true,
en_attente: true, derniere_erreur: e.derniere_erreur || '',
}));
}catch(e){ return []; }
}

async function offlineSupprimer(id){
return offlineTx('readwrite', (store) => store.delete(id));
}

async function offlineMarquerEchec(id, message){
return offlineTx('readwrite', (store) => new Promise((resolve, reject) => {
const req = store.get(id);
req.onsuccess = () => {
const item = req.result;
if(!item) return resolve();
item.tentatives += 1;
item.derniere_erreur = message;
store.put(item);
resolve();
};
req.onerror = () => reject(req.error);
}));
}

let offlineSyncEnCours = false;

/* Appelée au démarrage (si déjà en ligne) et à chaque retour de connexion.
Rafraîchit le compteur affiché dans l'en-tête, et si la fiche actuellement
ouverte est concernée, recharge son historique pour faire apparaître les
interventions tout juste envoyées. */
async function synchroniserInterventionsEnAttente(){
if(offlineSyncEnCours || !navigator.onLine) return;
offlineSyncEnCours = true;
let auMoinsUneEnvoyee = false, equipEnvoye = false;
try{
// 1) Les équipements d'abord : les interventions en attente peuvent les viser.
for(const eq of await offlineEquipLister()){
try{
const { error } = await sb.from('equipements').insert({
id: eq.id, organization_id: eq.organization_id, type_id: eq.type_id, nom: eq.nom,
serial_value: eq.serial_value, valeurs: eq.valeurs || {}, archived: false,
public_token: eq.public_token,
});
// 23505 sur la clé primaire : déjà envoyé (réponse perdue en route) — c'est bon.
if(error && !(error.code === '23505' && /pkey/.test(error.message || ''))) throw error;
await offlineEquipSupprimer(eq.id);
auMoinsUneEnvoyee = true; equipEnvoye = true;
}catch(e){
await offlineEquipMarquerEchec(eq.id, e.message || 'Erreur inconnue');
}
}
// 2) Puis les interventions.
const enAttente = await offlineListerEnAttente();
for(const item of enAttente){
try{
const { error } = await sb.from('interventions').insert({
equipement_id: item.equipement_id,
date: item.date,
type: item.type,
technicien: item.technicien,
description: item.description,
});
if(error) throw error;
await offlineSupprimer(item.id);
auMoinsUneEnvoyee = true;
}catch(e){
await offlineMarquerEchec(item.id, e.message || 'Erreur inconnue');
// On continue avec les suivantes : une erreur sur l'une ne doit pas
// bloquer l'envoi des autres.
}
}
}finally{
offlineSyncEnCours = false;
state.enAttenteCount = await offlineCompterEnAttente();
if(equipEnvoye){
toast('Équipements créés hors-ligne : envoyés');
reglages.parcs = {};
refreshDashboard();
}
if(typeof chargerIvEnAttente === 'function' && equipDetail.id) chargerIvEnAttente();
if(auMoinsUneEnvoyee && equipDetail.id){
try{
equipDetail.item = await getEquipement(equipDetail.id) || equipDetail.item;
equipDetail.horsLigne = false;
equipDetail.interventions = await listInterventions(equipDetail.id);
if(typeof chargerUrlsPhotos === 'function') chargerUrlsPhotos();
}catch(e){}
}
render();
}
}

window.addEventListener('online', () => { synchroniserInterventionsEnAttente(); });

/* ---------------------------------------------------------------------- */
