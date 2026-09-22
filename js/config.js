/* =========================================================================
   WiTracEQUIP — configuration
   -------------------------------------------------------------------------
   Tout ce qui se règle sans toucher au code de l'application est ici :
   adresse publique, connexion Supabase, format d'étiquette, rôles,
   et les modèles métiers proposés à un nouveau client.

   Ce fichier ne contient AUCUNE logique : uniquement des constantes.
   ========================================================================= */

/* -------------------------------------------------------------------------
   ADRESSE PUBLIQUE DE L'APPLICATION
   -------------------------------------------------------------------------
   Un QR code imprimé contient une adresse, et cette adresse est gravée dans
   l'étiquette pour toujours : si l'application déménage, toutes les étiquettes
   déjà collées deviennent mortes. C'est la raison pour laquelle cette valeur
   est figée ici plutôt que déduite de l'adresse du navigateur.

   Conséquence à connaître : même en test local, les QR codes générés pointent
   vers le domaine ci-dessous. Pour produire des QR pointant vers le serveur de
   test, et seulement dans ce cas, remettre temporairement une chaîne vide.
   ------------------------------------------------------------------------- */
export const APP_BASE_URL = 'https://witracequip.fr/';

/* -------------------------------------------------------------------------
   CONNEXION SUPABASE
   -------------------------------------------------------------------------
   Cette clé est la clé « publiable » (anon) : elle est conçue pour être lue
   par n'importe quel visiteur. Ce n'est pas elle qui protège les données —
   c'est le Row Level Security de Postgres, qui décide côté serveur ce que
   chaque compte a le droit de voir. Ne JAMAIS mettre ici la clé de service.
   ------------------------------------------------------------------------- */
export const SUPABASE_URL = 'https://oeqgyjyqdwlymlpfkdyn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_w3Lh6JYXepKHspWG5e06FQ_BpXaGQnE';

/* -------------------------------------------------------------------------
   ÉTIQUETTE IMPRIMÉE
   L'étiquette ne contient QUE le QR code et l'identifiant de l'équipement
   (immatriculation pour un véhicule, n° de série pour un appareil) : rien
   d'autre, pour tenir sur une imprimante thermique.
   ------------------------------------------------------------------------- */
export const ETIQUETTE = {
  taille_qr_mm: 30,           // côté du QR imprimé, en millimètres
  afficher_identifiant: true, // n° de série / immatriculation sous le QR
};

/* -------------------------------------------------------------------------
   MODE HORS LIGNE
   ------------------------------------------------------------------------- */
export const OFFLINE = {
  /* Nombre maximum de fiches équipement gardées en mémoire locale.
     Au-delà, la plus anciennement consultée est évincée. Une fiche pèse
     quelques kilo-octets ; 80 fiches tiennent largement dans le quota
     d'un navigateur mobile tout en couvrant une tournée d'intervention. */
  max_fiches_en_cache: 80,

  /* Préfixe de toutes les clés écrites dans le stockage local. Le changer
     revient à repartir d'un cache vide, sans rien casser côté serveur. */
  prefixe_stockage: 'wte.v1.',
};

/* -------------------------------------------------------------------------
   TYPES DE CHAMPS PERSONNALISÉS
   ------------------------------------------------------------------------- */
export const CHAMP_TYPES = [
  { v: 'text',     l: 'Texte' },
  { v: 'number',   l: 'Nombre' },
  { v: 'date',     l: 'Date' },
  { v: 'textarea', l: 'Texte long' },
];

/* -------------------------------------------------------------------------
   RÔLES ET DROITS
   -------------------------------------------------------------------------
   - utilisateur : créer un équipement, remplir / ajouter des interventions,
                   imprimer le QR
   - responsable : tout cela + retirer (archiver) un équipement
   - admin       : tout cela + gérer les profils (inviter, changer de rôle,
                   suspendre, cloisonner par métier)

   Ces règles sont AUSSI appliquées côté base (RLS + triggers) : masquer un
   bouton ici n'est qu'un confort d'affichage, la sécurité réelle est dans
   Supabase. Un bouton caché n'a jamais protégé une donnée.
   ------------------------------------------------------------------------- */
export const ROLE_LABELS = {
  admin: 'Administrateur',
  responsable: 'Responsable',
  utilisateur: 'Utilisateur',
};

export const ROLES_ASSIGNABLES = ['admin', 'responsable', 'utilisateur'];

export const ROLE_RESUME = {
  admin: "Tous les droits, y compris gérer l'équipe et inviter d'autres administrateurs.",
  responsable: 'Peut créer, remplir, imprimer et supprimer un équipement.',
  utilisateur: 'Peut créer, remplir et imprimer — mais pas supprimer.',
};

/* -------------------------------------------------------------------------
   MOTIFS DE RETRAIT
   -------------------------------------------------------------------------
   Le motif de retrait est obligatoire (cf. docs/AI_CONTEXT.md, règle métier
   n° 3). Cette liste n'est qu'une aide à la saisie : « Autre » ouvre un champ
   libre, car aucune liste fermée ne couvrira tous les cas d'un parc réel.
   ------------------------------------------------------------------------- */
export const MOTIFS_RETRAIT = [
  'Vendu / cédé',
  'Réformé (fin de vie)',
  'Détruit / accidenté',
  'Volé / perdu',
  'Retour au loueur',
  'Erreur de saisie (doublon)',
  'Autre',
];

/* -------------------------------------------------------------------------
   MODÈLES MÉTIERS
   -------------------------------------------------------------------------
   Parcs types des secteurs visés, avec les champs qui comptent pour la
   traçabilité réglementaire. Un administrateur les déploie en un clic chez
   un nouveau client, puis ajuste librement.

   Les dates de « prochain contrôle » sont volontairement des champs libres
   et non des alertes automatiques : l'application constate et trace, elle ne
   se substitue pas à l'organisme de contrôle.
   ------------------------------------------------------------------------- */
export const MODELES_METIERS = [
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
    description: "Parc d'un établissement de soins ou d'un cabinet.",
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
      { nom: 'Installation électrique', champs: [
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
