/* =========================================================================
WiTracEQUIP — carnet technique d'équipement (QR code)
Client-side SPA, connecté en direct à Supabase (organization_id / RLS).
Un seul fichier HTML — à héberger tel quel (Netlify, Vercel, GitHub Pages,
ou ton propre domaine witracequip.fr).
========================================================================= */

/* =========================================================================
ADRESSE PUBLIQUE DE L'APPLICATION
-------------------------------------------------------------------------
Un QR code imprimé contient une adresse, et cette adresse est gravée dans
l'étiquette pour toujours : si l'application déménage, toutes les étiquettes
déjà collées deviennent mortes.

Tant que cette ligne est vide, l'appli utilise l'adresse depuis laquelle elle
est ouverte — pratique pour tester, mais à ne PAS utiliser pour imprimer des
étiquettes en série.

Dès que le domaine définitif est en place, renseigner cette ligne :
const APP_BASE_URL = 'https://witracequip.fr/';
========================================================================= */
const APP_BASE_URL = '';

/* =========================================================================
ÉTIQUETTE IMPRIMÉE
L'étiquette ne contient QUE le QR code et l'identifiant de l'équipement
(immatriculation pour un véhicule, n° de série pour un appareil) : rien
d'autre, pour tenir sur une imprimante thermique.
Ajustez la taille selon le format de vos étiquettes.
========================================================================= */
const ETIQUETTE = {
taille_qr_mm: 16, // côté du QR imprimé, en millimètres — étiquette thermique 2 cm x 2 cm
afficher_identifiant: true, // n° de série / immatriculation sous le QR
};

/* Adresse du support : pied de page de toutes les pages + formulaire Support. */
const SUPPORT_EMAIL = 'widiagmq@gmail.com';

const SUPABASE_URL = 'https://oeqgyjyqdwlymlpfkdyn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w3Lh6JYXepKHspWG5e06FQ_BpXaGQnE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Logo WiTracEQUIP (utilisé sur l'écran de connexion et la page d'invitation) */
const LOGO_DATA_URL = 'assets/icons/icon-192.png';

const CHAMP_TYPES = [
{v:'text', l:'Texte'},
{v:'number', l:'Nombre'},
{v:'date', l:'Date'},
{v:'textarea', l:'Texte long'},
];

/* Rôles et droits
- utilisateur : créer un équipement, remplir/ajouter des interventions, imprimer le QR
- responsable : tout cela + supprimer (archiver) un équipement
- admin : tout cela + gérer les profils (inviter, changer de rôle, suspendre)
Ces règles sont AUSSI appliquées côté base (RLS + triggers) : masquer un bouton
ici n'est qu'un confort d'affichage, la sécurité réelle est dans Supabase. */
const ROLE_LABELS = {
admin: 'Administrateur',
responsable: 'Responsable',
utilisateur: 'Utilisateur',
};
const ROLES_ASSIGNABLES = ['admin', 'responsable', 'utilisateur'];

const ROLE_RESUME = {
admin: "Tous les droits sur son organisation : gérer les membres, supprimer définitivement équipements et interventions.",
responsable: "Crée, remplit, imprime, modifie les interventions et archive un équipement (avec motif).",
utilisateur: "Crée, remplit, imprime et modifie les interventions — sans archiver ni supprimer.",
};

/* Champ mot de passe avec aperçu (le petit œil) */
const ICONE_OEIL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONE_OEIL_BARRE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function champMotDePasse(autocomplete){
return `
<div class="pw-wrap">
<input type="password" name="password" placeholder="••••••••" minlength="6" required autocomplete="${autocomplete}">
<button type="button" class="pw-toggle" data-action="toggle-pw"
aria-label="Afficher le mot de passe" title="Afficher le mot de passe">${ICONE_OEIL}</button>
</div>`;
}

/* =========================================================================
MODÈLES MÉTIERS
Parcs types des secteurs visés, avec les champs qui comptent pour la
traçabilité réglementaire. Un administrateur les déploie en un clic chez
un nouveau client, puis ajuste librement.
========================================================================= */
const MODELES_METIERS = [
{
cle: 'hotellerie',
nom: 'Hôtellerie & résidences',
description: "Le parc technique d'un établissement recevant du public.",
types: [
{ nom: 'Climatisation / groupe froid', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Puissance (kW)', type:'number'}, {label:'Emplacement', type:'text'},
{label:'Fluide frigorigène', type:'text'},
{label:"Dernier contrôle d'étanchéité", type:'date'},
{label:'Prochaine inspection', type:'date'} ]},
{ nom: 'Groupe électrogène', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Puissance (kVA)', type:'number'}, {label:'Emplacement', type:'text'},
{label:'Heures de fonctionnement', type:'number'},
{label:'Dernier essai en charge', type:'date'}, {label:'Prochain essai', type:'date'} ]},
{ nom: 'Extincteur', champs: [
{label:'Type (eau, CO2, poudre)', type:'text'}, {label:'Capacité', type:'text'},
{label:'Emplacement', type:'text'}, {label:'Date de fabrication', type:'date'},
{label:'Dernière vérification annuelle', type:'date'},
{label:'Prochaine révision décennale', type:'date'} ]},
{ nom: 'Ascenseur', champs: [
{label:'Marque', type:'text'}, {label:"N° d'appareil", type:'text'},
{label:'Emplacement', type:'text'}, {label:'Société de maintenance', type:'text'},
{label:'Dernier contrôle technique', type:'date'}, {label:'Prochain contrôle', type:'date'} ]},
{ nom: 'Équipement de cuisine', champs: [
{label:'Type', type:'text'}, {label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Emplacement', type:'text'}, {label:'Dernier entretien', type:'date'} ]},
{ nom: 'Installation électrique', champs: [
{label:'Emplacement (TGBT, tableau divisionnaire)', type:'text'},
{label:'Bureau de contrôle', type:'text'},
{label:'Dernière vérification annuelle', type:'date'},
{label:'Observations levées', type:'textarea'} ]},
],
},
{
cle: 'btp',
nom: 'BTP & levage',
description: 'Matériel de chantier soumis à vérification générale périodique.',
types: [
{ nom: 'Engin de chantier', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Année', type:'number'}, {label:'Heures', type:'number'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'} ]},
{ nom: 'Nacelle élévatrice', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Hauteur de travail (m)', type:'number'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'},
{label:'Organisme de contrôle', type:'text'} ]},
{ nom: 'Chariot élévateur', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Capacité (kg)', type:'number'}, {label:'Heures', type:'number'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'} ]},
{ nom: 'Échafaudage', champs: [
{label:'Type', type:'text'}, {label:'Hauteur (m)', type:'number'},
{label:'Chantier', type:'text'}, {label:'Date de montage', type:'date'},
{label:'Dernière vérification', type:'date'} ]},
{ nom: 'EPI antichute', champs: [
{label:'Type (harnais, longe, antichute)', type:'text'}, {label:'Taille', type:'text'},
{label:'Attribué à', type:'text'}, {label:'Date de mise en service', type:'date'},
{label:'Dernière vérification annuelle', type:'date'} ]},
{ nom: 'Groupe électrogène de chantier', champs: [
{label:'Marque', type:'text'}, {label:'Puissance (kVA)', type:'number'},
{label:'Heures', type:'number'}, {label:'Dernier entretien', type:'date'} ]},
],
},
{
cle: 'sante',
nom: 'Santé & biomédical',
description: 'Parc d\'un établissement de soins ou d\'un cabinet.',
types: [
{ nom: 'Dispositif médical', champs: [
{label:'Fabricant', type:'text'}, {label:'Modèle', type:'text'},
{label:'Service / localisation', type:'text'}, {label:'Classe', type:'text'},
{label:'Date de mise en service', type:'date'},
{label:'Prochaine maintenance préventive', type:'date'} ]},
{ nom: 'Défibrillateur (DAE)', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Emplacement', type:'text'},
{label:'Péremption des électrodes', type:'date'},
{label:'Péremption de la batterie', type:'date'},
{label:'Dernière vérification', type:'date'} ]},
{ nom: 'Lit médicalisé', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Service', type:'text'}, {label:'Dernière vérification électrique', type:'date'} ]},
{ nom: 'Équipement de stérilisation', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Service', type:'text'}, {label:'Dernier contrôle de charge', type:'date'},
{label:'Prochaine requalification', type:'date'} ]},
{ nom: 'Groupe électrogène de secours', champs: [
{label:'Marque', type:'text'}, {label:'Puissance (kVA)', type:'number'},
{label:'Emplacement', type:'text'}, {label:'Dernier essai en charge', type:'date'},
{label:'Prochain essai', type:'date'} ]},
{ nom: 'Climatisation zone sensible', champs: [
{label:'Emplacement (bloc, pharmacie, labo)', type:'text'},
{label:'Puissance (kW)', type:'number'},
{label:'Dernier contrôle', type:'date'}, {label:'Prochain contrôle', type:'date'} ]},
],
},
{
cle: 'industrie',
nom: 'Industrie & logistique',
description: 'Atelier, ligne de production, entrepôt, chaîne du froid.',
types: [
{ nom: 'Machine de production', champs: [
{label:'Fabricant', type:'text'}, {label:'Modèle', type:'text'},
{label:"N° d'inventaire", type:'text'}, {label:'Ligne / atelier', type:'text'},
{label:'Date de mise en service', type:'date'},
{label:'Prochaine maintenance préventive', type:'date'} ]},
{ nom: 'Chariot élévateur', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Capacité (kg)', type:'number'}, {label:'Heures', type:'number'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'} ]},
{ nom: 'Pont roulant / palan', champs: [
{label:'Marque', type:'text'}, {label:'Capacité (t)', type:'number'},
{label:'Emplacement', type:'text'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'} ]},
{ nom: 'Compresseur / appareil à pression', champs: [
{label:'Marque', type:'text'}, {label:'Volume (L)', type:'number'},
{label:'Pression de service (bar)', type:'number'}, {label:'Emplacement', type:'text'},
{label:'Dernière inspection', type:'date'},
{label:'Prochaine requalification', type:'date'} ]},
{ nom: 'Chambre froide', champs: [
{label:'Emplacement', type:'text'}, {label:'Volume (m3)', type:'number'},
{label:'Fluide frigorigène', type:'text'},
{label:"Dernier contrôle d'étanchéité", type:'date'},
{label:'Prochain contrôle', type:'date'} ]},
{ nom: 'Installation électrique', champs:
[
{label:'Emplacement', type:'text'}, {label:'Bureau de contrôle', type:'text'},
{label:'Dernière vérification annuelle', type:'date'},
{label:'Observations levées', type:'textarea'} ]},
],
},
{
cle: 'flotte',
nom: 'Flotte & atelier automobile',
description: 'Véhicules de service, location, garage ou concession.',
types: [
{ nom: 'Véhicule', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Kilométrage', type:'number'},
{label:'Prochain contrôle technique', type:'date'},
{label:'Prochaine révision', type:'date'},
{label:'Conducteur attribué', type:'text'} ]},
{ nom: 'Élévateur de garage / pont', champs: [
{label:'Marque', type:'text'}, {label:'Capacité (t)', type:'number'},
{label:'Emplacement', type:'text'},
{label:'Dernière VGP', type:'date'}, {label:'Prochaine VGP', type:'date'} ]},
{ nom: 'Outillage de diagnostic', champs: [
{label:'Marque', type:'text'}, {label:'Modèle', type:'text'},
{label:'Version logicielle', type:'text'},
{label:'Dernière mise à jour', type:'date'} ]},
{ nom: "Compresseur d'atelier", champs: [
{label:'Marque', type:'text'}, {label:'Volume (L)', type:'number'},
{label:'Pression (bar)', type:'number'},
{label:'Dernière inspection', type:'date'} ]},
],
},
];

function roleLabel(r){ return ROLE_LABELS[r] || r || '—'; }
function isAdmin(){ return state.profile?.role === 'admin'; }
function peutSupprimer(){ return ['admin','responsable'].includes(state.profile?.role); }
// Créer / modifier les types d'équipement et leurs champs : administrateur et responsable.
// L'utilisateur simple s'en sert sans les voir (vérifié aussi par la base, sql/10).
function peutGererTypes(){ return ['admin','responsable'].includes(state.profile?.role); }

const state = {
session: null,
profile: null, // { id, organization_id, full_name, role, fondateur }
superAdmin: false, // super-administrateur plateforme (WiDIAG MQ) : gère tous les clients
orgName: '',
route: parseHash(),
types: [],
typesLoaded: false,
loading: true,
authMode: 'login', // 'login' | 'signup'
authError: '',
authNotice: '',
authBusy: false,
accessError: '', // 'ACCES_SUSPENDU' ou message d'erreur au chargement du profil
enAttenteCount: 0, // nombre d'interventions saisies hors-ligne pas encore envoyées à Supabase
};

function parseHash(){
const h = location.hash.replace(/^#\/?/, '');
const parts = h.split('/').filter(Boolean);
// Sans route explicite, on arrive sur l'accueil, pas sur la liste.
return { name: parts[0] || 'accueil', param: parts[1] || null, sub: parts[2] || null };
}

function nav(path){ location.hash = path; }

window.addEventListener('hashchange', () => {
state.route = parseHash();
if(typeof fermerCommandesFondateur === 'function') fermerCommandesFondateur();
// Ouvrir une fiche force son rechargement, quelle que soit la façon d'y arriver
// (clic, scan d'un QR code, retour arrière, lien collé) : plusieurs personnes
// travaillent sur la même base, les données en cache peuvent être périmées.
if(state.route.name === 'equip') equipDetail.id = null;
if(state.route.name === 'p' || state.route.name === 'equip') fichePublique.token = null;
// Filet de sécurité : si on change de route par un autre biais que le bouton
// « fermer » du scanner (retour arrière du téléphone, par exemple), on
// coupe quand même la caméra — sinon elle continuerait de tourner en fond.
if(typeof scannerState !== 'undefined' && scannerState.ouvert) fermerScanner();
// Changer de page ferme toute fenêtre modale restée ouverte.
if(typeof modal !== 'undefined' && modal && !modal.busy) modal = null;
render();
});

