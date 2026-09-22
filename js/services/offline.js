/* Hors-ligne : file d'attente des interventions                          */
/* ---------------------------------------------------------------------- */
/* Une intervention saisie sans réseau est stockée dans IndexedDB, puis
envoyée à Supabase dès que la connexion revient. Rien n'est mis en cache
ici : c'est un stockage local DE BROUILLONS EN ATTENTE D'ENVOI, pas un
cache de données serveur — sw.js continue de ne jamais mettre en cache les
requêtes Supabase (voir son en-tête), ce module ne change rien à ça.

Limite assumée (option retenue) : saisir une intervention hors-ligne n'est
possible que depuis la fiche d'un équipement déjà ouverte (donc déjà en
mémoire) — pas de liste d'équipements gardée en local pour l'instant. */

const OFFLINE_DB_NOM = 'wte-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'interventions_en_attente';

function offlineOuvrirDB(){
return new Promise((resolve, reject) => {
const req = indexedDB.open(OFFLINE_DB_NOM, OFFLINE_DB_VERSION);
req.onupgradeneeded = () => {
const db = req.result;
if(!db.objectStoreNames.contains(OFFLINE_STORE)){
const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
store.createIndex('equipement_id', 'equipement_id', { unique: false });
}
};
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}

async function offlineTx(mode, fn){
const db = await offlineOuvrirDB();
return new Promise((resolve, reject) => {
const transaction = db.transaction(OFFLINE_STORE, mode);
const store = transaction.objectStore(OFFLINE_STORE);
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

async function offlineCompterEnAttente(){
return offlineTx('readonly', (store) => new Promise((resolve, reject) => {
const req = store.count();
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
}));
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
let auMoinsUneEnvoyee = false;
try{
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
if(auMoinsUneEnvoyee && equipDetail.id){
try{ equipDetail.interventions = await listInterventions(equipDetail.id); }catch(e){}
}
render();
}
}

window.addEventListener('online', () => { synchroniserInterventionsEnAttente(); });

/* ---------------------------------------------------------------------- */
