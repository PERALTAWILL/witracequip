/* =========================================================================
   WiTracEQUIP — bascule français / anglais
   -------------------------------------------------------------------------
   - Le français reste la langue par défaut : tant que l'utilisateur n'a pas
     choisi « English », ce module ne modifie RIEN dans l'application.
   - En anglais, les textes affichés sont traduits à la volée (dictionnaire
     ci-dessous) ; le contenu saisi par les clients n'est jamais touché.
   - Le choix est mémorisé sur l'appareil (localStorage « wte_lang »).
   - Fondateur : bouton « Traduire en anglais » sur chaque demande de support
     (traduction sur l'appareil si le navigateur le permet, sinon liens vers
     un traducteur externe ouverts uniquement sur clic).
   ========================================================================= */
(function(){
try {
'use strict';
var KEY = 'wte_lang';
var D = {
" · raccourci Ctrl/⌘ K":" · shortcut Ctrl/⌘ K",
"(facultatif)":"(optional)",
"). Le PDF du rapport est bien inclus.":"). The report PDF is included.",
"+ Ajouter un type d'équipement":"+ Add an equipment type",
"+ Nouvel équipement":"+ New equipment",
", ouvrez WiTracEQUIP.":", open WiTracEQUIP.",
"? Elle disparaît du carnet de cet équipement. Une copie est conservée dans le journal.":"? It will disappear from this equipment's logbook. A copy is kept in the journal.",
"ACCÈS & SÉCURITÉ":"ACCESS & SECURITY",
"Abandonner cet équipement ? Il n'a jamais été envoyé : il disparaît de ce téléphone, ainsi que les interventions saisies dessus sans réseau.":"Abandon this equipment? It was never sent: it will be removed from this phone, along with any interventions entered on it offline.",
"Actions du client":"Client actions",
"Actualiser le tableau de bord":"Refresh dashboard",
"Adresse de la personne qui recevra ce rapport. Elle peut être différente du contact principal du client.":"Address of the person who will receive this report. It may differ from the client's main contact.",
"Afficher le mot de passe":"Show password",
"Ajouter un rappel à mon agenda":"Add a reminder to my calendar",
"Année":"Year",
"Applications et accès rapides":"Apps and quick access",
"Argile":"Clay",
"Ascenseur B — visiteurs":"Elevator B — visitors",
"Au moins":"At least",
"Aucun client ne l'utilise.":"No client uses it.",
"Aucun résultat pour ces filtres":"No results for these filters",
"Aucune demande clôturée":"No closed requests",
"Aujourd'hui":"Today",
"Autre":"Other",
"Bonjour, Voici votre lien personnel pour créer votre compte WiTracEQUIP":"Hello, Here is your personal link to create your WiTracEQUIP account",
"CENTRE DE PILOTAGE":"CONTROL CENTER",
"Carnet d'entretien tenu avec WiTracEQUIP — by WiDIAG MQ.":"Maintenance log kept with WiTracEQUIP — by WiDIAG MQ.",
"Ce numéro est déjà enregistré":"This number is already registered",
"Centrale de traitement d'air — bloc":"Air handling unit — block",
"Chambre froide":"Cold room",
"Chantier":"Site",
"Chariot élévateur":"Forklift",
"Choisissez le client pour lequel créer ce lien.":"Choose the client to create this link for.",
"Classe":"Class",
"Client supprimé":"Client deleted",
"Climatisation":"Air conditioning",
"Climatiseurs chambres (lot de 30)":"Room air conditioners (lot of 30)",
"Compris":"Got it",
"Conditions, contrat, remarques…":"Terms, contract, notes…",
"Confirmez : cet ordinateur s'ouvre pour":"Confirm: this computer opens for",
"Consultation publique fermée : scanner l'étiquette ne montre plus rien.":"Public access closed: scanning the label no longer shows anything.",
"Contrôle réglementaire":"Regulatory inspection",
"Copié !":"Copied!",
"Créer":"Create",
"Créer un type d'équipement d'abord":"Create an equipment type first",
"Dans «":"In “",
"Date de mise en service":"Commissioning date",
"Demande classée dans « Traitées »":"Request moved to “Handled”",
"Demande supprimée":"Request deleted",
"Demandez un nouveau lien à l'administrateur de votre organisation.":"Ask your organization's administrator for a new link.",
"Dernier contrôle technique":"Last technical inspection",
"Dernière inspection":"Last inspection",
"Dernière vérification électrique":"Last electrical check",
"Dispositif médical":"Medical device",
"Dupliquer":"Duplicate",
"Défibrillateur (DAE)":"Defibrillator (AED)",
"Dépannage":"Breakdown repair",
"EPI antichute":"Fall-arrest PPE",
"Effacez le champ pour voir toute la liste.":"Clear the field to see the whole list.",
"Emplacement (bloc, pharmacie, labo)":"Location (ward, pharmacy, lab)",
"Enregistrement…":"Saving…",
"Enregistrer les modifications":"Save changes",
"Erreur :":"Error:",
"Escalier nord":"North staircase",
"Ex : Entretien, Réparation, Contrôle…":"E.g.: Maintenance, Repair, Inspection…",
"Ex : Véhicule":"E.g.: Vehicle",
"Export impossible :":"Export failed:",
"Extincteurs — étages (lot de 20)":"Fire extinguishers — floors (lot of 20)",
"Fermer la consultation publique ? Les étiquettes déjà collées sur cet équipement ne montreront plus rien à ceux qui les scannent.":"Close public access? Labels already stuck on this equipment will no longer show anything to those who scan them.",
"Fiche entreprise":"Company sheet",
"Filtrer par catégorie":"Filter by category",
"Fondateur · WiDIAG MQ":"Founder · WiDIAG MQ",
"Garage partenaire":"Partner garage",
"Groupe électrogène de secours":"Backup generator",
"Hauteur (m)":"Height (m)",
"Hier":"Yesterday",
"Historique des interventions":"Intervention history",
"Il réapparaîtra":"It will reappear",
"Impossible de préparer l'e-mail :":"Unable to prepare the email:",
"Indicateurs du parc":"Fleet indicators",
"Informations spécifiques au type":"Type-specific information",
"Intervention ajoutée":"Intervention added",
"Intervention réalisée":"Intervention completed",
"Invitation annulée":"Invitation cancelled",
"Inviter un membre":"Invite a member",
"Joindre une photo":"Attach a photo",
"Journal indisponible sans réseau : il se mettra à jour au retour de la connexion.":"Journal unavailable offline: it will update when the connection returns.",
"Kilométrage":"Mileage",
"La fiche, son QR code et":"The record, its QR code and",
"La session sur cet ordinateur se ferme dans 2 minutes. Enregistrez votre saisie en cours. Pour continuer ensuite, scannez à nouveau le QR code avec votre téléphone.":"The session on this computer will close in 2 minutes. Save what you are entering. To continue afterwards, scan the QR code again with your phone.",
"Le client atteste la réalisation de l'intervention décrite dans ce rapport.":"The client certifies that the intervention described in this report was carried out.",
"Le parc technique d'un établissement recevant du public.":"The technical fleet of a public-access building.",
"Le type «":"The type “",
"Les changements s'appliquent aux prochains clients créés avec ce métier. Les types déjà créés chez vos clients ne bougent pas : modifiez-les depuis la fiche du client → Types.":"Changes apply to the next clients created with this trade template. Types already created for your clients are unchanged: edit them from the client's record → Types.",
"Les membres de votre organisation, leurs rôles et ce qu'ils peuvent voir.":"Your organization's members, their roles and what they can see.",
"Lien d'invitation créé":"Invitation link created",
"Lit médicalisé":"Hospital bed",
"Marque":"Brand",
"Membres":"Members",
"Mes demandes":"My requests",
"Modifier":"Edit",
"Modifier le type":"Edit type",
"Modifiez la recherche ou les catégories sélectionnées.":"Change the search or the selected categories.",
"Modèles métier":"Trade templates",
"Moniteur multiparamétrique — box 2":"Multiparameter monitor — box 2",
"Mot de passe actuel":"Current password",
"Mot de passe provisoire":"Temporary password",
"Mot de passe trop faible : au moins":"Password too weak: at least",
"Médecine":"Medicine",
"NOM DU SIGNATAIRE":"SIGNER'S NAME",
"Niveaux desservis":"Floors served",
"Nom de la personne intervenue":"Name of the person who performed the work",
"Nom du métier":"Trade name",
"Nom non renseigné":"Name not provided",
"Nouveau client":"New client",
"Nouvel équipement":"New equipment",
"ORGANISATION":"ORGANIZATION",
"Ordinateur ouvert jusqu'à":"Computer open until",
"Ouvrez sa fiche en un geste, caméra directe":"Open its record in one move, direct camera",
"Ouvrir les demandes clients et demandes à traiter":"Open client requests and requests to handle",
"PDF téléchargés (autorisez les téléchargements multiples si le navigateur le demande)":"PDFs downloaded (allow multiple downloads if your browser asks)",
"Partir d'un modèle métier":"Start from a trade template",
"Pas de réseau : liste":"No network: list",
"Photos (facultatif)":"Photos (optional)",
"Plus sur site":"More on site",
"Portefeuille clients":"Client portfolio",
"Pour toute demande, contactez le support :":"For any request, contact support:",
"Première connexion : utilisez votre téléphone. C'est lui qui ouvrira ensuite l'ordinateur, en scannant un QR code.":"First sign-in: use your phone. It will then be the one that opens the computer, by scanning a QR code.",
"Prestataire incendie":"Fire safety provider",
"Prochain contrôle technique":"Next technical inspection",
"Prochaine maintenance préventive":"Next preventive maintenance",
"Profil changé de client":"Profile moved to another client",
"Profils":"Profiles",
"Promouvoir ce profil ADMINISTRATEUR de son organisation ?":"Promote this profile to ADMINISTRATOR of its organization?",
"Prénom Nom":"First name Last name",
"Puissance (kVA)":"Power (kVA)",
"QR code à scanner avec votre téléphone":"QR code to scan with your phone",
"RDC à R+4":"Ground floor to 4th floor",
"Rapport d'intervention":"Intervention report",
"Rapport prêt à envoyer Destinataire :":"Report ready to send Recipient:",
"Rapports des parcs clients":"Client fleet reports",
"Rattacher":"Link",
"Rechercher un client : nom, n°, référent, ville…":"Search for a client: name, no., contact, city…",
"Remplacement de pièce":"Part replacement",
"Reprendre sur ce téléphone ? La session ouverte sur l'ordinateur sera fermée immédiatement.":"Resume on this phone? The session open on the computer will be closed immediately.",
"Restitué au loueur":"Returned to lessor",
"Retirer la photo":"Remove photo",
"Retour aux clients":"Back to clients",
"Rez-de-chaussée":"Ground floor",
"Réanimation":"Intensive care",
"Réf.":"Ref.",
"Réglages effectués selon la notice constructeur.":"Adjustments made according to the manufacturer's manual.",
"Réparation carrosserie":"Bodywork repair",
"Résumé du support":"Support summary",
"SUITE DE L'INTERVENTION":"INTERVENTION FOLLOW-UP",
"Sam":"Sat",
"Sans type":"No type",
"Scanner un QR code pour ouvrir directement une fiche équipement":"Scan a QR code to open an equipment record directly",
"Sections du client":"Client sections",
"Session fermée : votre téléphone est de nouveau actif.":"Session closed: your phone is active again.",
"Société de maintenance":"Maintenance company",
"Sujet":"Subject",
"Suppression impossible :":"Unable to delete:",
"Supprimer cette ligne":"Delete this line",
"Supprimer l'intervention «":"Delete the intervention “",
"Sur":"On",
"Taille":"Size",
"Touchez":"Tap",
"Tout déplier":"Expand all",
"Toute personne qui scanne cette étiquette lit le carnet d'entretien : contrôleur, inspecteur, assureur, acheteur. Sans compte et sans inscription — et sans rien pouvoir modifier.":"Anyone who scans this label can read the maintenance log: inspector, auditor, insurer, buyer. No account and no sign-up — and unable to change anything.",
"Trier":"Sort",
"Type inconnu":"Unknown type",
"Types d’équipement":"Equipment types",
"Téléphone perdu, volé ou remplacé : déconnecter cette personne partout et lui permettre de se reconnecter sur un nouvel appareil":"Phone lost, stolen or replaced: sign this person out everywhere and let them sign back in on a new device",
"Une question, un souci, une réclamation ? Écrivez-nous ici : votre message part directement chez WiDIAG MQ (":"A question, a problem, a complaint? Write to us here: your message goes straight to WiDIAG MQ (",
"VOTRE ESPACE":"YOUR SPACE",
"Ven":"Fri",
"Vidange":"Oil change",
"Visite de maintenance":"Maintenance visit",
"Volé / perdu":"Stolen / lost",
"Votre compte est utilisé sur":"Your account is being used on",
"Votre espace.":"Your space.",
"Vous n'avez pas le droit de modifier ce profil.":"You are not allowed to edit this profile.",
"Vue globale":"Overview",
"Vérification annuelle":"Annual check",
"WiTracEQUIP, intervention, maintenance, traçabilité":"WiTracEQUIP, intervention, maintenance, traceability",
"archivé":"archived",
"caractères, avec des lettres et des chiffres.":"characters, with letters and digits.",
"ce client":"this client",
"document(s) joint(s) n'ont pas pu être récupérés (":"attached document(s) could not be retrieved (",
"en attente d'envoi":"pending upload",
"et accède dès sa prochaine ouverture de l'appli à tout le parc de":"and gets access, the next time the app is opened, to the whole fleet of",
"export Excel contient 3 onglets : Synthèse, Équipements (avec le nombre d":"Excel export contains 3 sheets: Summary, Equipment (with the number of",
"intacts, seule l'étiquette du métier est retirée.":"intact, only the trade label is removed.",
"la base a refusé l'opération (aucune ligne modifiée).":"the database refused the operation (no rows modified).",
"module PDF introuvable":"PDF module not found",
"notifications archivées":"archived notifications",
"photos maximum par intervention":"photos maximum per intervention",
"rapport(s) sur":"report(s) out of",
"résultat":"result",
"sélectionné":"selected",
"un coup le parc type d":"at once the fleet of type",
"» apparaît deux fois.":"” appears twice.",
"» dépasse 10 Mo : non ajouté.":"” exceeds 10 MB: not added.",
"», le champ «":"”, the field “",
"ÉQUIPES & HISTORIQUE":"TEAMS & HISTORY",
"Équip.":"Equip.",
"Équipement créé":"Equipment created",
"Équipement supprimé":"Equipment deleted",
"Équipements créés hors-ligne : envoyés":"Equipment created offline: sent",
"échéance":"due date",
"équipements archivés":"archived equipment",
"— données simulées pour la démonstration":"— simulated data for demonstration",
"• Une trace est gardée dans le journal Irréversible. Pour un départ temporaire, préférez « Suspendre ».":"• A trace is kept in the journal Irreversible. For a temporary departure, prefer “Suspend”.",
"(actuellement :":"(currently:",
"(encore":"(still",
"(hors vous)":"(excluding you)",
"(résultats)":"(results)",
"). Retirez-les ou réessayez.":"). Remove them or try again.",
"+ Inviter un membre":"+ Invite a member",
", tout reste à portée.":", everything stays within reach.",
"? La personne quitte":"? The person leaves",
"ACCÈS DIRECT":"QUICK ACCESS",
"Abandonner":"Abandon",
"Actions d’administration":"Admin actions",
"Actualiser les demandes":"Refresh requests",
"Adresse e-mail du destinataire":"Recipient email address",
"Ajouter":"Add",
"Ajouter une autre photo":"Add another photo",
"Annuler":"Cancel",
"Anomalie corrigée, remise en service.":"Fault fixed, back in service.",
"Archivage impossible :":"Unable to archive:",
"Atelier, ligne de production, entrepôt, chaîne du froid.":"Workshop, production line, warehouse, cold chain.",
"Aucun PDF n'a pu être préparé :":"No PDF could be prepared:",
"Aucun client pour l'instant. Créez le premier avec « + Nouveau client ».":"No clients yet. Create the first one with “+ New client”.",
"Aucun type d'équipement chez ce client.":"No equipment type for this client.",
"Aucune intervention enregistrée pour l'instant.":"No interventions recorded yet.",
"Aujourd’hui":"Today",
"Avancer sans détour":"Get straight to the point",
"Bleu nuit":"Midnight blue",
"Bonsoir":"Good evening",
"CODE CLIENT":"CLIENT CODE",
"Capacité":"Capacity",
"Catégories d’équipement":"Equipment categories",
"Ce profil voit l'ensemble du parc.":"This profile sees the entire fleet.",
"Cette page est une consultation libre : elle ne permet aucune modification.":"This page is read-only: it does not allow any changes.",
"Champ du modèle métier attribué par WiDIAG MQ":"Field from the trade template assigned by WiDIAG MQ",
"Chaque fonction à sa place, toujours accessible.":"Every function in its place, always accessible.",
"Chercher dans le parc : nom, n° de série, type…":"Search the fleet: name, serial no., type…",
"Choisissez un motif de retrait.":"Choose a reason for removal.",
"Client suspendu":"Client suspended",
"Climatisation / groupe froid":"Air conditioning / cooling unit",
"Clinique Les Flamboyants (démonstration)":"Clinique Les Flamboyants (demo)",
"Compte lié à un appareil":"Account linked to a device",
"Conducteur attribué":"Assigned driver",
"Connexion nécessaire pour calculer les statistiques du parc.":"Connection required to compute fleet statistics.",
"Contrôle effectué, rapport joint en photo.":"Inspection completed, report attached as photo.",
"Contrôle technique":"Technical inspection",
"Crée d'un coup le parc type d'un secteur, avec les champs qui comptent pour la traçabilité. Rien n'est écrasé, tout reste modifiable ensuite.":"Creates a sector's typical fleet in one go, with the fields that matter for traceability. Nothing is overwritten, and everything stays editable afterwards.",
"Créer l'équipement":"Create equipment",
"Créer une organisation":"Create an organization",
"DATE D'INTERVENTION":"INTERVENTION DATE",
"Date de montage":"Installation date",
"Demande d'évolution":"Feature request",
"Demandes clients":"Client requests",
"Dernier contrôle":"Last inspection",
"Dernier entretien":"Last service",
"Dernière mise à jour":"Last updated",
"Descendre":"Move down",
"Documents joints":"Attached documents",
"Déconnexion à distance (appareil libéré)":"Remote sign-out (device released)",
"Défibrillateur DAE — 2e étage":"AED defibrillator — 2nd floor",
"Désenfumage — cage d'escalier":"Smoke extraction — stairwell",
"ESPACE FONDATEUR":"FOUNDER AREA",
"En cours":"In progress",
"Enregistrer":"Save",
"Erreur d'affichage :":"Display error:",
"Ex : Marc Dupont":"E.g.: Marc Dupont",
"Ex : doublon, créé par erreur…":"E.g.: duplicate, created by mistake…",
"Export prêt":"Export ready",
"Fermer la session":"Sign out",
"Fiche indisponible":"Record unavailable",
"Filtrer par état":"Filter by status",
"Générez un lien d'invitation : la personne rejoint":"Generate an invitation link: the person joins",
"Hauteur de travail (m)":"Working height (m)",
"Historique des opérations":"Operations history",
"INTERVENANT":"TECHNICIAN",
"Impossible de préparer le PDF :":"Unable to prepare the PDF:",
"Indiquez au moins le prénom et le nom.":"Enter at least the first and last name.",
"Installation électrique":"Electrical installation",
"Intervention enregistrée":"Intervention saved",
"Intervention supprimée":"Intervention deleted",
"Invitées, compte pas encore créé (":"Invited, account not yet created (",
"Journal":"Log",
"Journal vidé":"Log cleared",
"L'équipement sort du parc actif. Sa fiche et tout son historique restent conservés et consultables (« Voir les archivés »). Il pourra être restauré.":"The equipment leaves the active fleet. Its record and full history are kept and remain viewable (“View archived”). It can be restored.",
"La maîtrise.":"Mastery.",
"La session sur l'ordinateur est terminée. Pour continuer, scannez à nouveau avec votre téléphone.":"The computer session has ended. To continue, scan again with your phone.",
"Le mot de passe doit faire au moins":"The password must be at least",
"Le sujet et le message sont obligatoires.":"Subject and message are required.",
"Le téléphone a repris la main : la session sur l'ordinateur est fermée.":"The phone has taken over: the computer session is closed.",
"Les demandes de vos clients, les statistiques et l’export Excel d’un parc (démonstration comprise), et les modèles métier proposés quand vous créez un client.":"Your clients' requests, statistics and the Excel export of a fleet (demo included), and the trade templates offered when you create a client.",
"Les nouvelles demandes apparaîtront ici dès leur réception.":"New requests will appear here as soon as they are received.",
"Ligne / atelier":"Line / workshop",
"Lit médicalisé ch. 204":"Hospital bed, room 204",
"Machine de production":"Production machine",
"Masquer le mot de passe":"Hide password",
"Membres de l’équipe":"Team members",
"Modifier l'intervention":"Edit intervention",
"Modifier mon mot de passe":"Change my password",
"Modifiée le":"Modified on",
"Mon équipe":"My team",
"Monte-charge cuisine":"Kitchen dumbwaiter",
"Mot de passe actuel incorrect.":"Current password is incorrect.",
"Mot de passe provisoire :":"Temporary password:",
"Motif":"Reason",
"Mélangez au moins des lettres et des chiffres.":"Mix at least letters and numbers.",
"Nacelle élévatrice":"Aerial work platform",
"Nom A → Z":"Name A → Z",
"Nom de votre interlocuteur":"Your contact's name",
"Nom du support":"Support name",
"Nom saisi à la main (client hors liste).":"Name entered manually (client not in list).",
"Notes internes":"Internal notes",
"Nouveau code":"New code",
"Nouvelles":"New",
"Observations levées":"Observations cleared",
"Organisme de contrôle":"Inspection body",
"Ouvrez un client pour voir tout son parc et gérer sa fiche, ses membres et ses invitations.":"Open a client to see their whole fleet and manage their record, members and invitations.",
"Ouvrir sur cet ordinateur":"Open on this computer",
"PC sécurité":"Security control room",
"PDF à enregistrer":"PDF to save",
"Pas de réseau : fiche de la dernière consultation. Vous pouvez saisir une intervention, elle partira au retour du réseau. L'historique complet s'affichera à la reconnexion.":"No network: showing the record from the last visit. You can enter an intervention; it will be sent when the network returns. The full history will show on reconnection.",
"Pas de réseau : réessayez une fois connecté.":"No network: try again once connected.",
"Pièce d'usure remplacée, essais concluants.":"Worn part replaced, tests successful.",
"Pneumatiques":"Tyres",
"Pour changer ou compléter le modèle, cliquez sur « Modifier ».":"To change or complete the template, click “Edit”.",
"Pousse-seringue n° 1":"Syringe pump no. 1",
"Pression (bar)":"Pressure (bar)",
"Priorisez les demandes, répondez et clôturez sans changer d’écran.":"Prioritize requests, reply and close them without changing screens.",
"Prochain essai":"Next test",
"Prochaine requalification":"Next requalification",
"Profil supprimé":"Profile deleted",
"Profils & accès":"Profiles & access",
"Proposés quand vous créez un client, et dans « Partir d'un modèle métier » de la page Types. Les modifier ne change rien chez les clients déjà créés.":"Offered when you create a client, and in “Start from a trade template” on the Types page. Editing them changes nothing for clients already created.",
"Préparation…":"Preparing…",
"Puissance (kW)":"Power (kW)",
"Raison de l'intervention":"Reason for intervention",
"Rapport d'intervention -":"Intervention report -",
"Rapport supprimé":"Report deleted",
"Rapports d’intervention":"Intervention reports",
"Recharge de gaz":"Gas recharge",
"Rechercher un profil : nom, prénom, email, client…":"Search for a profile: name, first name, email, client…",
"Responsable":"Manager",
"Retirer":"Remove",
"Retirer le type «":"Remove type “",
"Retour à la connexion":"Back to sign-in",
"Rose saumon":"Salmon pink",
"Récentes":"Recent",
"Réformée — remplacée par PS-2203":"Decommissioned — replaced by PS-2203",
"Réinitialiser":"Reset",
"Réseau indisponible : intervention enregistrée hors-ligne, elle sera envoyée automatiquement dès la reconnexion.":"Network unavailable: intervention saved offline, it will be sent automatically once you reconnect.",
"Révision":"Overhaul",
"SIGNATURE DU CLIENT":"CLIENT SIGNATURE",
"SUITE DU RAPPORT":"REPORT CONTINUED",
"Sans limite.":"No limit.",
"Santé & biomédical":"Health & biomedical",
"Scanner un équipement":"Scan equipment",
"Sera créé dès le retour du réseau · n° client attribué à ce moment-là":"Will be created when the network returns · client no. assigned at that time",
"Session ordinateur":"Computer session",
"Statistiques & export":"Statistics & export",
"Suppression refusée : seul un administrateur peut supprimer une intervention.":"Deletion refused: only an administrator can delete an intervention.",
"Supprimer cette ligne du journal ?":"Delete this log line?",
"Supprimer la demande «  »":"Delete the request “”",
"Suspendre":"Suspend",
"Technicien de l'équipe ? « Se connecter » en haut de page ouvre la fiche complète.":"Team technician? “Sign in” at the top of the page opens the full record.",
"Tous les clients":"All clients",
"Tout est à jour":"All up to date",
"Toutes":"All",
"Types en place":"Existing types",
"Un QR code sur chaque équipement : historique d'entretien consultable en 2 secondes, photos à l'appui, même sans réseau. Mise en service et SAV aux Antilles.":"A QR code on every piece of equipment: maintenance history viewable in 2 seconds, backed by photos, even without network. Commissioning and after-sales service in the French Antilles.",
"Urgences":"Emergencies",
"VOTRE PORTEFEUILLE":"YOUR PORTFOLIO",
"Vendu":"Sold",
"Vider le journal":"Clear log",
"Voir les archivés":"View archived",
"Vos clients.":"Your clients.",
"Votre demande est bien enregistrée et sera traitée par WiDIAG MQ. (L'email automatique n'a pas pu partir — si c'est urgent, écrivez directement à":"Your request has been recorded and will be handled by WiDIAG MQ. (The automatic email could not be sent — if urgent, write directly to",
"Votre nom complet":"Your full name",
"Vous pouvez tout de même enregistrer : ce n'est qu'un avertissement.":"You can still save: this is only a warning.",
"Véhicule":"Vehicle",
"WiTracEQUIP · Espace Fondateur":"WiTracEQUIP · Founder Area",
"ZIP téléchargé :":"ZIP downloaded:",
"accès. Rien n":"access. Nothing",
"avec le rôle et les accès choisis.":"with the chosen role and access.",
"caractères, en mélangeant lettres et chiffres.":"characters, mixing letters and numbers.",
"cet équipement":"this equipment",
"d'équipement ·":"of equipment ·",
"déc.":"Dec.",
"en cours":"in progress",
"et supprimer définitivement équipements et interventions.":"and permanently delete equipment and interventions.",
"intervention(s) effacée(s) avec l'équipement.":"intervention(s) deleted along with the equipment.",
"le type manquant":"the missing type",
"module ZIP introuvable":"ZIP module not found",
"premières sont gardées":"the first ones are kept",
"rapport(s) n'ont pas pu être exportés.":"report(s) could not be exported.",
"rapports dans un ZIP":"reports in a ZIP",
"s dépassées":"s overdue",
"tout son historique d'interventions":"its entire intervention history",
"une minute dès que l":"a minute as soon as the",
"« Scanner un QR code »":"“Scan a QR code”",
"» créé":"” created",
"» enregistré":"” saved",
"À portée de main.":"Within reach.",
"Échafaudage":"Scaffolding",
"Équipe":"Team",
"Équipement de cuisine":"Kitchen equipment",
"Équipement supprimé définitivement":"Equipment permanently deleted",
"Étalonnage":"Calibration",
"équip.":"equip.",
"équipements supprimés":"equipment deleted",
"— voir le parc":"— view the fleet",
"← Retour aux métiers":"← Back to trades",
"(appli installée)":"(app installed)",
"(facultatif — PDF, photo, Word, Excel… 10 Mo max chacun)":"(optional — PDF, photo, Word, Excel… 10 MB max each)",
") et vous recevrez la réponse par email.":") and you will receive the reply by email.",
"). Vous pourrez ensuite limiter ses accès à certains types. Le changement est tracé dans le journal.":"). You can then restrict their access to certain types. The change is recorded in the journal.",
"+ Joindre un document":"+ Attach a document",
", avec leurs signatures et leurs documents joints. Cette action est irréversible.":", along with their signatures and attached documents. This action cannot be undone.",
"12 derniers mois — survolez ou touchez une barre pour le détail.":"Last 12 months — hover over or tap a bar for details.",
"? Perte immédiate de l'accès, sans rien supprimer.":"? Access is lost immediately, nothing is deleted.",
"ACTIONS PRIORITAIRES":"PRIORITY ACTIONS",
"Abandonner ce client Il n'a pas encore été envoyé : il sera définitivement supprimé de ce téléphone.":"Discard this client It has not been sent yet: it will be permanently deleted from this phone.",
"Accueil":"Home",
"Actions rapides":"Quick actions",
"Administrateur":"Administrator",
"Adresse provisoire : ce QR code pointe vers l'adresse actuelle de l'application. Ne pas imprimer d'étiquettes en série avant que le domaine définitif soit en place.":"Temporary address: this QR code points to the app's current address. Do not print labels in bulk until the final domain is in place.",
"Ajouter quelqu'un":"Add someone",
"Ambulance n° 1":"Ambulance no. 1",
"Annuler cette invitation ? Le lien ne fonctionnera plus.":"Cancel this invitation? The link will no longer work.",
"Appareil":"Device",
"Archiver":"Archive",
"Ascenseur":"Elevator",
"Attention :":"Warning:",
"Aucun champ : l'équipement n'aura que son nom et son n° de série.":"No fields: the equipment will only have its name and serial no.",
"Aucun membre pour l'instant.":"No members yet.",
"Aucun type d'équipement.":"No equipment types.",
"Aucune intervention sur les 12 derniers mois.":"No interventions in the last 12 months.",
"Autoclave stérilisation":"Sterilization autoclave",
"Bonjour":"Hello",
"CLIENT N°":"CLIENT NO.",
"COMPTE RENDU":"REPORT",
"Capacité (kg)":"Capacity (kg)",
"Ce lien d'invitation n'est plus valable : il a déjà été utilisé, il a expiré, ou il a été annulé.":"This invitation link is no longer valid: it has already been used, has expired, or has been cancelled.",
"Ce qui s'est passé sur votre parc ces 7 derniers jours. Archivez une notification pour la retirer, retrouvez-la dans « Archivées ». Chaque notification s'efface automatiquement au bout d'une semaine.":"What happened on your fleet over the last 7 days. Archive a notification to remove it; find it under “Archived”. Each notification is automatically cleared after one week.",
"Cette personne verra l'ensemble du parc.":"This person will see the entire fleet.",
"Changer le lien":"Change link",
"Chaque suppression, archivage ou modification d'intervention est tracé ici : qui, quand, pourquoi.":"Every deletion, archiving or edit of an intervention is recorded here: who, when, why.",
"Chirurgie":"Surgery",
"Choisissez votre mot de passe":"Choose your password",
"Client de la liste sélectionné.":"Client from the list selected.",
"Climatisation zone sensible":"Sensitive-area air conditioning",
"Compresseur / appareil à pression":"Compressor / pressure equipment",
"Compte ouvert sur un ordinateur":"Account open on a computer",
"Confirmer":"Confirm",
"Connexion refusée (autre appareil)":"Sign-in refused (other device)",
"Contrôle périodique":"Periodic inspection",
"Coordonnées et modèle métier":"Contact details and trade template",
"Crée, remplit, imprime les équipements, ajoute des interventions et peut les corriger en justifiant sa modification — sans archiver ni supprimer.":"Creates, fills in and prints equipment, adds interventions and can correct them with a reason — without archiving or deleting.",
"Le motif est obligatoire.":"A reason is required.",
"Motif de la suppression (obligatoire)":"Reason for deletion (required)",
"Le motif de la modification est obligatoire.":"A reason for the edit is required.",
"Motif de la modification":"Reason for the edit",
"Ex : erreur de date, intervenant mal renseigné…":"E.g. wrong date, technician filled in incorrectly…",
"La modification est horodatée à votre nom ; l'ancienne version est conservée dans le journal.":"The edit is timestamped in your name; the previous version is kept in the log.",
"La modification est horodatée à votre nom ; l'ancienne version et le motif sont conservés dans le journal.":"The edit is timestamped in your name; the previous version and the reason are kept in the log.",
"Créer le client":"Create client",
"Créé sans réseau, en attente d'envoi.":"Created offline, waiting to be sent.",
"Date de fabrication":"Manufacturing date",
"Date du jour":"Today's date",
"Demande marquée en cours":"Request marked in progress",
"Demandes de support":"Support requests",
"Dernier contrôle d'étanchéité":"Last leak test",
"Dernier essai en charge":"Last load test",
"Dernière vérification":"Last check",
"Donner un mot de passe provisoire":"Give a temporary password",
"Décrivez la raison de l'intervention et ce qui a été fait…":"Describe the reason for the intervention and what was done…",
"Défibrillateur DAE — hall":"AED defibrillator — lobby",
"Détails de l'intervention…":"Intervention details…",
"Emplacement":"Location",
"En quelques mots":"In a few words",
"Enregistrer / partager":"Save / share",
"Envoyer le rapport par e-mail Le PDF va être téléchargé, puis votre messagerie s'ouvrira avec le destinataire (":"Send the report by email The PDF will be downloaded, then your email app will open with the recipient (",
"Erreur de chargement du profil.":"Error loading profile.",
"Ex : AB-123-CD":"E.g. AB-123-CD",
"Ex : Renault Kangoo — WD-12":"E.g. Renault Kangoo — WD-12",
"Ex : vendu à la société X, remplacé par…":"E.g. sold to company X, replaced by…",
"Extincteur":"Fire extinguisher",
"Fabricant":"Manufacturer",
"Fermer la session sur cet ordinateur ? Votre téléphone redevient actif immédiatement. Pensez à enregistrer une saisie en cours.":"Sign out on this computer? Your phone becomes active again immediately. Remember to save any entry in progress.",
"Fichier Excel prêt :":"Excel file ready:",
"Flotte & atelier automobile":"Vehicle fleet & workshop",
"Groupe électrogène":"Generator",
"Gérer les modèles de fiche":"Manage record templates",
"Heures":"Hours",
"Historique complet":"Full history",
"Hors service / réformé":"Out of service / decommissioned",
"Il lui sera demandé d'en choisir un nouveau à la connexion.":"They will be asked to choose a new one at sign-in.",
"Ils réapparaîtront":"They will reappear",
"Indicateurs de gestion":"Management indicators",
"Industrie & logistique":"Industry & logistics",
"Intervenant":"Technician",
"Intervention enregistrée avec":"Intervention saved with",
"Interventions / mois":"Interventions / month",
"Invitations en attente":"Pending invitations",
"Journal des suppressions et modifications":"Deletions and edits journal",
"LA BIBLIOTHÈQUE DE DIRECTION":"THE EXECUTIVE LIBRARY",
"La modification est horodatée à votre nom et l'ancienne version est conservée dans le journal.":"The edit is time-stamped under your name and the previous version is kept in the journal.",
"La vision.":"The vision.",
"Le nom de l'intervenant est obligatoire.":"The technician's name is required.",
"Le type d'intervention est obligatoire.":"The intervention type is required.",
"Les 45 minutes sur l'ordinateur sont écoulées. Pour continuer, scannez à nouveau avec votre téléphone.":"The 45 minutes on the computer have elapsed. To continue, scan again with your phone.",
"Les deux saisies du nouveau mot de passe ne sont pas identiques.":"The two entries of the new password do not match.",
"Les photos n'ont pas pu être envoyées (":"The photos could not be sent (",
"Ligne supprimée":"Row deleted",
"Lit médicalisé ch. 211":"Medical bed rm. 211",
"Maintenance préventive":"Preventive maintenance",
"Matériel de chantier soumis à vérification générale périodique.":"Construction equipment subject to periodic general inspection.",
"Mer":"Wed",
"Mesures et exports de parc":"Fleet metrics and exports",
"Modifier la fiche":"Edit record",
"Modifier mon nom":"Edit my name",
"Modèle":"Model",
"Mon établissement":"My facility",
"Monter":"Move up",
"Mot de passe enregistré":"Password saved",
"Mot de passe réinitialisé":"Password reset",
"Motif (facultatif, gardé dans le journal)":"Reason (optional, kept in the journal)",
"Métier supprimé":"Trade template deleted",
"Navigation principale":"Main navigation",
"Nom de l'entreprise":"Company name",
"Nom du champ (ex : Date de fabrication)":"Field name (e.g. Manufacturing date)",
"Nom du type (ex : Extincteur)":"Type name (e.g. Fire extinguisher)",
"Nom, n° de série ou plaque…":"Name, serial no. or plate…",
"Notification archivée":"Notification archived",
"Nouveau mot de passe":"New password",
"N° d'appareil":"Device no.",
"Obsolète":"Obsolete",
"Outillage de diagnostic":"Diagnostic tools",
"Ouvrir la messagerie":"Open email app",
"Ouvrir votre compte sur un ordinateur 1. Sur l'ordinateur, ouvrez WiTracEQUIP et connectez-vous avec votre e-mail et votre mot de passe. 2. Un QR code s'affiche : scannez-le avec ce téléphone. L'ordinateur est alors ouvert 45 minutes et ce téléphone passe en pause.":"Open your account on a computer 1. On the computer, open WiTracEQUIP and sign in with your email and password. 2. A QR code appears: scan it with this phone. The computer is then open for 45 minutes and this phone goes on pause.",
"PDF prêt":"PDF ready",
"Parc d'un établissement de soins ou d'un cabinet.":"Fleet of a healthcare facility or a practice.",
"Pas de réseau : intervention enregistrée hors-ligne, elle sera envoyée automatiquement dès la reconnexion.":"No network: intervention saved offline; it will be sent automatically once you reconnect.",
"Passeport numérique de vos équipements":"Digital passport for your equipment",
"Photo de profil mise à jour":"Profile photo updated",
"Plus gros parc":"Largest fleet",
"Pompe à perfusion ancienne génération":"Older-generation infusion pump",
"Pour des raisons de sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.":"For security reasons, sign out and sign back in before changing the password.",
"Pousse-seringue n° 2":"Syringe pump no. 2",
"Pression de service (bar)":"Working pressure (bar)",
"Problème technique":"Technical issue",
"Prochaine VGP":"Next VGP inspection",
"Prochaine révision":"Next service",
"Profil(s) réactivé(s)":"Profile(s) reactivated",
"Profils actifs":"Active profiles",
"Précisez le motif.":"Please specify the reason.",
"Préparer les secteurs clients":"Set up client sectors",
"Péremption de la batterie":"Battery expiry",
"Qui a réalisé l'intervention ?":"Who performed the intervention?",
"Rappels de révision des équipements":"Equipment service reminders",
"Rapport d'intervention ·":"Intervention report ·",
"Rapports, statistiques et modèles métier restent dans le menu déroulant de l’onglet Support.":"Reports, statistics and trade templates remain in the dropdown menu of the Support tab.",
"Rechercher : sujet, client, email…":"Search: subject, client, email…",
"Rechercher une demande de support":"Search support requests",
"Rendre la main au téléphone":"Hand control back to the phone",
"Restauration impossible :":"Restore impossible:",
"Retirer ce champ":"Remove this field",
"Retiré le":"Removed on",
"Retrait enregistré au nom de":"Removal recorded under the name of",
"Rue, code postal, commune":"Street, postal code, city",
"Réclamation":"Complaint",
"Référent":"Contact person",
"Réinitialiser le mot de passe de":"Reset the password of",
"Résumé du client":"Client summary",
"Rôle":"Role",
"Sans nom":"Unnamed",
"Scanner le QR code":"Scan QR code",
"Se connecter":"Sign in",
"Service":"Department",
"Si l'équipement a simplement quitté le parc (vendu, obsolète…), préférez « Archiver » : l'historique reste consultable.":"If the equipment has simply left the fleet (sold, obsolete…), prefer “Archive”: the history remains viewable.",
"Support & réclamations":"Support & complaints",
"Supprimer":"Delete",
"Supprimer définitivement":"Delete permanently",
"Supprimer le métier «":"Delete the trade template “",
"Synthèse du parc":"Fleet overview",
"Texte":"Text",
"Tous les comptes de vos clients : recherchez par nom, prénom, email ou client, puis modifiez, changez le rôle, suspendez ou supprimez.":"All your clients' accounts: search by last name, first name, email or client, then edit, change the role, suspend or delete.",
"Tout replier":"Collapse all",
"Traitées":"Resolved",
"Type (eau, CO2, poudre)":"Type (water, CO2, powder)",
"Types d'équipement":"Equipment types",
"Télécharger et ouvrir la messagerie":"Download and open email app",
"Un métier s'appelle déjà «":"A trade template is already named “",
"Utilisateur":"User",
"Validation client":"Client validation",
"Version logicielle":"Software version",
"Vider tout le journal ? Les":"Clear the entire journal? The",
"Vos collaborateurs : consultez leurs profils et suspendez ou réactivez leur accès à l'application.":"Your team members: view their profiles and suspend or reactivate their access to the app.",
"Votre email de réponse":"Your reply email",
"Votre parc est prêt à démarrer.":"Your fleet is ready to go.",
"Vous vous êtes connecté avec un mot de passe provisoire. Choisissez le vôtre pour continuer (au moins":"You signed in with a temporary password. Choose your own to continue (at least",
"Véhicule de liaison":"Courtesy vehicle",
"ajout d":"addition of",
"caractères, lettres et chiffres).":"characters, letters and digits).",
"définitivement effacé":"permanently erased",
"est changé tant que vous n":"is changed as long as you don",
"et visez ce code.":"and point it at this code.",
"févr.":"Feb.",
"impossible de charger le module PDF (pas de connexion ?)":"unable to load the PDF module (no connection?)",
"intervention. C":"intervention. T",
"min : enregistrez votre saisie.":"min: save your entry.",
"n'a pas de nom.":"has no name.",
"ordinateur ouvert jusqu'à":"computer open until",
"rapport(s) n'ont pas pu être préparés (":"report(s) could not be prepared (",
"rapports supprimés":"reports deleted",
"seront effacés. Les étiquettes déjà collées ne montreront plus rien. Une copie est gardée dans le journal.":"will be erased. Labels already stuck on will no longer show anything. A copy is kept in the journal.",
"traitée":"resolved",
"vont être joints. Choisissez votre messagerie dans la liste qui s'ouvre, puis saisissez l'adresse du destinataire (elle vient d'être copiée).":"will be attached. Choose your email app from the list that opens, then enter the recipient's address (it has just been copied).",
"· valable jusqu'au":"· valid until",
"» de ce métier ? Rien n'est effacé chez vos clients.":"” of this trade template? Nothing is deleted for your clients.",
"» n'est pas une image lisible ou dépasse 5 Mo.":"” is not a readable image or exceeds 5 MB.",
"À traiter":"To process",
"Élévateur de garage / pont":"Garage lift / hoist",
"Équipement abandonné":"Equipment discarded",
"Équipement de stérilisation":"Sterilization equipment",
"Équipements":"Equipment",
"à moins de 30 jours":"within 30 days",
"équipement":"equipment",
"— Aucun pour l'instant —":"— None yet —",
"— vérifiez les autres.":"— check the others.",
"⏳ en attente d'envoi":"⏳ waiting to be sent",
"(copie)":"(copy)",
"(facultatif — tapez un nom ou choisissez dans la liste)":"(optional — type a name or choose from the list)",
"), l'objet et le message déjà remplis. Il ne restera qu'à joindre le PDF téléchargé":"), subject and message already filled in. All that's left is to attach the downloaded PDF",
"+ Ajouter":"+ Add",
"+ Nouveau métier":"+ New trade",
", avec son rôle actuel (":", with their current role (",
"2,5 kW / unité":"2.5 kW / unit",
"Abandonner cet équipement (non envoyé)":"Abandon this equipment (not sent)",
"Accéder directement à une fiche":"Go directly to a record",
"Actualiser":"Refresh",
"Adresse":"Address",
"Afficher":"Show",
"Ajouter un champ est sans risque : les équipements existants l'afficheront, vide, jusqu'à ce qu'il soit renseigné. Retirer un champ le fait disparaître des fiches mais n'efface rien : le remettre avec le même nom fait réapparaître les valeurs.":"Adding a field is safe: existing equipment will show it, empty, until it is filled in. Removing a field hides it from records but erases nothing: adding it back with the same name makes the values reappear.",
"Ambulance n° 2":"Ambulance no. 2",
"Annuler l'invitation":"Cancel the invitation",
"Applications & actions":"Apps & actions",
"Archivées":"Archived",
"Ascenseur A — patients":"Elevator A — patients",
"Attribué à":"Assigned to",
"Aucun client ne correspond à «":"No client matches «",
"Aucun profil ne correspond à «":"No profile matches «",
"Aucune adresse e-mail valide n'est enregistrée pour ce rapport. Utilisez « Modifier » pour la renseigner.":"No valid email address is saved for this report. Use “Edit” to enter one.",
"Aucune signature associée":"No associated signature",
"Autoriser l'ordinateur":"Authorize this computer",
"BTP & levage":"Construction & lifting",
"Bonjour, Veuillez trouver ci-joint le rapport d'intervention réalisé le":"Hello, Please find attached the intervention report completed on",
"Bureau de contrôle":"Inspection body",
"COMPTE RENDU / MAINTENANCE":"SERVICE REPORT / MAINTENANCE",
"Capacité (t)":"Capacity (t)",
"Ce lien est valable 14 jours et ne peut servir qu'une fois. Cordialement, WiDIAG MQ":"This link is valid for 14 days and can only be used once. Kind regards, WiDIAG MQ",
"Centrale de détection incendie":"Fire detection control panel",
"Cette étiquette ne correspond à aucune fiche consultable. Elle a pu être remplacée, ou la consultation publique a été fermée par le propriétaire de l'équipement.":"This label does not match any viewable record. It may have been replaced, or public viewing was closed by the equipment owner.",
"Changer le lien public ? Toutes les étiquettes déjà imprimées pour cet équipement cesseront de fonctionner : il faudra en réimprimer une. La fiche et son historique sont conservés.":"Change the public link? All labels already printed for this equipment will stop working: you will need to print a new one. The record and its history are kept.",
"Chargement impossible :":"Unable to load:",
"Choisissez au moins un type d'équipement, sinon cette personne n'aurait accès à rien.":"Choose at least one equipment type, otherwise this person would have access to nothing.",
"Client réactivé":"Client reactivated",
"Clients créés hors-ligne : envoyés":"Clients created offline: sent",
"Climatiseur salle serveurs":"Server room air conditioner",
"Compresseur d'atelier":"Workshop compressor",
"Comptes, rôles et accès":"Accounts, roles and access",
"Confirmer le nouveau":"Confirm the new one",
"Connexion requise pour inviter un membre.":"You must be signed in to invite a member.",
"Contrôle qualité":"Quality control",
"Copier":"Copy",
"Comme l'utilisateur, sans avoir à justifier ses modifications, et en plus supprime les interventions (avec motif) et archive un équipement (avec motif).":"Same as the user, without having to justify edits, and also deletes interventions (with a reason) and archives equipment (with a reason).",
"Créer un lien d'invitation ADMINISTRATEUR pour":"Create an ADMINISTRATOR invitation link for",
"DESTINATAIRE":"RECIPIENT",
"Date de l'intervention":"Date of the intervention",
"Demande":"Request",
"Demande remise à traiter":"Request put back to be processed",
"Demandes reçues, suivi et résolution au même endroit.":"Requests received, follow-up and resolution in one place.",
"Dernier contrôle de charge":"Last load test",
"Dernière VGP":"Last periodic inspection",
"Dernière vérification annuelle":"Last annual check",
"Dim":"Sun",
"Donnez un nom au métier.":"Give the trade a name.",
"Décrivez votre demande : équipement concerné, ce qui s'est passé…":"Describe your request: which equipment, what happened…",
"Dégâts constatés, devis transmis à la direction.":"Damage observed, quote sent to management.",
"EN UN REGARD":"AT A GLANCE",
"EXT-RDC":"EXT-GF",
"Emplacement (TGBT, tableau divisionnaire)":"Location (main panel, sub-panel)",
"Engin de chantier":"Construction machine",
"Enregistrer le type":"Save the type",
"Envoyer par mail":"Send by email",
"Erreur inconnue":"Unknown error",
"Ex : CHU Martinique":"E.g.: CHU Martinique",
"Ex : Restauration collective":"E.g.: Catering",
"Export Excel du parc":"Fleet Excel export",
"Extincteurs — RDC (lot de 12)":"Fire extinguishers — ground floor (batch of 12)",
"Fermer":"Close",
"Fermer le tiroir":"Close the drawer",
"Fichier de signature indisponible":"Signature file unavailable",
"Fluide frigorigène":"Refrigerant",
"Groupe électrogène de chantier":"Construction site generator",
"Gérer les types":"Manage types",
"Heures de fonctionnement":"Operating hours",
"Historique complet des suppressions, archivages et modifications : qui, quand et pourquoi. Conservé sans limite de durée.":"Full history of deletions, archiving and edits: who, when and why. Kept with no time limit.",
"Hôtellerie & résidences":"Hotels & residences",
"Il pourra gérer tout le parc de son organisation, en modifier les membres":"They will be able to manage the whole fleet of their organization and edit its members",
"Image illisible":"Unreadable image",
"Indicateurs du Fondateur":"Founder indicators",
"Informations":"Information",
"Intervenant :":"Technician:",
"Intervention modifiée":"Intervention edited",
"Interventions par mois sur 12 mois":"Interventions per month over 12 months",
"Invitations en attente (":"Pending invitations (",
"Jeu":"Thu",
"Journal d’activité":"Activity log",
"La date de l'intervention est obligatoire.":"The intervention date is required.",
"La session sur cet ordinateur se ferme dans":"The session on this computer closes in",
"Le PDF":"The PDF",
"Le nouveau mot de passe doit être différent de l'ancien.":"The new password must be different from the old one.",
"Le type n°":"Type no.",
"Les champs « modèle » viennent de votre modèle métier : vous pouvez en ajouter d'autres, pas les retirer.":"The “model” fields come from your trade template: you can add others, but not remove them.",
"Les indicateurs n’ont pas pu être chargés.":"The indicators could not be loaded.",
"Lien copié dans le presse-papiers":"Link copied to the clipboard",
"Lun":"Mon",
"Mar":"Tue",
"Membre supprimé":"Member deleted",
"Merci, votre demande a bien été envoyée au support. Vous recevrez une réponse par email.":"Thank you, your request has been sent to support. You will receive a reply by email.",
"Mise en service du suivi":"Tracking start-up",
"Modifier le nom et le prénom":"Edit first and last name",
"Modifier mon nom Prénom et nom, tels qu'ils apparaîtront dans l'application et sur vos prochaines interventions.":"Edit my name First and last name, as they will appear in the app and on your future interventions.",
"Modèle métier":"Trade template",
"Moniteur multiparamétrique — box 1":"Multiparameter monitor — box 1",
"Mot de passe":"Password",
"Mot de passe modifié":"Password changed",
"Mot de passe réinitialisé Transmettez à":"Password reset Pass it on to",
"Motif du retrait":"Reason for removal",
"Métier «":"Trade «",
"Nettoyage des filtres":"Filter cleaning",
"Nom de la personne (facultatif)":"Person's name (optional)",
"Nom du champ (ex : Kilométrage)":"Field name (e.g.: Mileage)",
"Nom mis à jour":"Name updated",
"Nombre":"Number",
"Nous restons à votre disposition pour toute information complémentaire. Cordialement,":"We remain at your disposal for any further information. Kind regards,",
"Nouveau type":"New type",
"N° d'inventaire":"Inventory no.",
"Ordinateur ouvert (45 min)":"Computer authorized (45 min)",
"Outils":"Tools",
"Ouvrir le tiroir ":"Open drawer ",
"Ouvrir votre espace de travail":"Open your workspace",
"PDF téléchargé :":"PDF downloaded:",
"Parc technique":"Equipment fleet",
"Pas de réseau : la modification d'une intervention nécessite une connexion.":"No network: editing an intervention requires a connection.",
"Photo de profil supprimée":"Profile photo removed",
"Plus récents":"Most recent",
"Pont roulant / palan":"Overhead crane / hoist",
"Pour la garder sans l'avoir sous les yeux, utilisez plutôt « Traitée → archiver ».":"To keep it without having it in view, use “Resolved → archive” instead.",
"Pousse-seringue n° 3":"Syringe pump no. 3",
"Prestataire ascenseurs":"Elevator contractor",
"Prochain contrôle":"Next check",
"Prochaine inspection":"Next inspection",
"Prochaine révision décennale":"Next ten-year overhaul",
"Profil(s) suspendu(s)":"Suspended profile(s)",
"Promouvoir":"Promote",
"Précision":"Accuracy",
"Puissance":"Power",
"Péremption des électrodes":"Electrode expiry",
"RAS, équipement conforme.":"Nothing to report, equipment compliant.",
"Rapport":"Report",
"Rapport introuvable. Actualisez la liste.":"Report not found. Refresh the list.",
"Rapports d'intervention":"Intervention reports",
"Rapports_intervention_":"Intervention_reports_",
"Rechercher et gérer les dossiers":"Search and manage accounts",
"Remplacement":"Replacement",
"Reprendre ici":"Resume here",
"Restaurer":"Restore",
"Retirer ce type":"Remove this type",
"Retour":"Back",
"Retrouvez un dossier, son parc et les personnes qui y travaillent.":"Find an account, its fleet and the people who work there.",
"Réactiver":"Reactivate",
"Réessayer":"Try again",
"Réglages":"Settings",
"Réparation":"Repair",
"Résumé du parc d’équipements":"Equipment fleet summary",
"Rôle mis à jour :":"Role updated:",
"SS à RDC":"B to GF",
"Saisissez votre mot de passe actuel.":"Enter your current password.",
"Sans ouvrir de menu":"Without opening a menu",
"Scanner un QR code":"Scan a QR code",
"Se déconnecter":"Sign out",
"Service / localisation":"Department / location",
"Signature non disponible":"Signature not available",
"Stérilisation":"Sterilization",
"Support clients":"Customer support",
"Supprimer ce métier":"Delete this trade",
"Supprimer définitivement cette demande ? «":"Permanently delete this request? «",
"Supprimer ma photo de profil ? Vos initiales seront affichées à la place. Vous pourrez en ajouter une nouvelle à tout moment.":"Delete my profile photo? Your initials will be shown instead. You can add a new one at any time.",
"Sécurité incendie":"Fire safety",
"Texte long":"Long text",
"Tous les droits sur son organisation : gérer les membres, supprimer définitivement équipements et interventions.":"Full rights over their organization: manage members, permanently delete equipment and interventions.",
"Tout sélectionner":"Select all",
"Traçabilité d’une intervention technique":"Traceability of a technical intervention",
"Type (harnais, longe, antichute)":"Type (harness, lanyard, fall arrester)",
"Types d'équipement (":"Equipment types (",
"Téléphone":"Phone",
"Une phrase pour le reconnaître":"A phrase to recognize it",
"VOTRE CLIENT":"YOUR CLIENT",
"Valider":"Confirm",
"Vert foncé":"Dark green",
"Violet":"Purple",
"Votre accès WiTracEQUIP":"Your WiTracEQUIP access",
"Votre espace de travail":"Your workspace",
"Vous avez été déconnecté à distance par WiDIAG MQ. Reconnectez-vous avec votre e-mail et votre mot de passe.":"You were signed out remotely by WiDIAG MQ. Sign in again with your email and password.",
"Vue":"View",
"Véhicules de service, location, garage ou concession.":"Company vehicles, rental, garage or dealership.",
"WiTracEQUIP — Le passeport numérique de vos équipements":"WiTracEQUIP — The digital passport for your equipment",
"[SW] Échec d'enregistrement :":"[SW] Registration failed:",
"août":"August",
"by WiDIAG MQ · Passeport numérique de vos équipements":"by WiDIAG MQ · Digital passport for your equipment",
"caractères.":"characters.",
"de traçabilité (suppressions, archivages, modifications) de tous vos clients seront effacées définitivement.":"audit trail entries (deletions, archiving, edits) for all of your clients will be permanently erased.",
"dépassée":"overdue",
"est déconnecté(e) : reconnexion possible sur un nouvel appareil":"is signed out: can sign in again on a new device",
"exemple@entreprise.fr":"example@company.com",
"historique). Les photos restent dans l":"history). The photos remain in the",
"impossible de charger le module ZIP (pas de connexion ?)":"unable to load the ZIP module (no connection?)",
"l'accès à l'application.":"access to the app.",
"photos maximum : seules les":"photos maximum: only the",
"profils supprimés":"profiles deleted",
"rapport(s) supprimé(s) sur":"report(s) deleted from",
"rattaché à":"linked to",
"son client actuel":"its current client",
"un appareil":"a device",
"votre téléphone":"your phone",
"» ? Il ne sera plus proposé pour les nouveaux clients.":"» ? It will no longer be offered for new clients.",
"» du":"» of",
"» n'est pas une image lisible.":"» is not a readable image.",
"À traiter et demandes archivées":"To process and archived requests",
"Émeraude":"Emerald",
"Équipement archivé":"Equipment archived",
"Équipement restauré":"Equipment restored",
"Équipements actifs":"Active equipment",
"à traiter":"to process",
"équipements":"equipment",
"— actualisez la liste et réessayez.":"— refresh the list and try again.",
"• Les comptes de connexion sont effacés • Les interventions qu'ils ont enregistrées sont CONSERVÉES":"• Login accounts are deleted • The interventions they recorded are KEPT",
"🔒 Consultation en lecture seule":"🔒 Read-only view",
"+ Ajouter un champ":"+ Add a field",
"+ Nouveau client":"+ New client",
"+ Équipement":"+ Equipment",
"ANALYSER & ADMINISTRER":"ANALYZE & ADMINISTER",
"Actifs":"Active",
"Adapter les fiches à votre activité":"Tailor the records to your business",
"Administrateur de son organisation :":"Administrator of their organization:",
"Ajouter ces":"Add these",
"Ajouter un équipement":"Add equipment",
"Ajoutez votre premier équipement pour générer son QR code.":"Add your first piece of equipment to generate its QR code.",
"Analyser votre parc":"Analyze your fleet",
"Annuler la modification":"Cancel edit",
"Appareil autorisé :":"Authorized device:",
"Archivés":"Archived",
"Aucun appareil lié : le premier utilisé sera retenu":"No linked device: the first one used will be kept",
"Aucun changement visible.":"No visible changes.",
"Aucun modèle métier":"No business template",
"Aucun modèle métier ne vous a été attribué pour l'instant. Contactez WiDIAG MQ.":"No business template has been assigned to you yet. Contact WiDIAG MQ.",
"Aucun résultat":"No results",
"Aucun type pour l'instant.":"No types yet.",
"Aucun équipement dans ce parc pour l'instant.":"No equipment in this fleet yet.",
"Aucun équipement ne correspond à «":"No equipment matches \"",
"Aucun équipement pour l'instant":"No equipment yet",
"Aucune intervention enregistrée à ce jour.":"No interventions recorded to date.",
"Aucune invitation en attente.":"No pending invitations.",
"Aucune raison renseignée.":"No reason provided.",
"Bonjour,":"Hello,",
"CARNET TECHNIQUE":"TECHNICAL LOGBOOK",
"COMPTE FONDATEUR":"FOUNDER ACCOUNT",
"CRÉER & EXPLORER":"CREATE & EXPLORE",
"Cadrez le QR code de l'équipement":"Point the camera at the equipment's QR code",
"Ce téléphone est en pause : un compte ne s'utilise que sur un appareil à la fois. Il redevient actif tout seul à la fin de la session ordinateur.":"This phone is paused: an account can only be used on one device at a time. It becomes active again automatically when the computer session ends.",
"Certaines données ne sont pas disponibles actuellement.":"Some data is not available at the moment.",
"Cet espace est réservé au compte principal Fondateur de WiTracEQUIP.":"This area is reserved for the main WiTracEQUIP Founder account.",
"Cette section est réservée à l'administrateur.":"This section is reserved for the administrator.",
"Chargement des invitations…":"Loading invitations…",
"Chargement…":"Loading…",
"Client créé — n°":"Client created — no.",
"Client introuvable.":"Client not found.",
"Clôturer":"Close",
"Couleur du thème":"Theme color",
"Crée chez ce client :":"Creates for this client:",
"Créez-en un pour préparer d'un coup le parc type d'un secteur.":"Create one to set up a sector's typical fleet in one go.",
"Créé le":"Created on",
"Dans":"In",
"Dernier essai refusé :":"Last attempt refused:",
"Dernière":"Last",
"Dernière intervention":"Last intervention",
"Destinataire :":"Recipient:",
"Documents joints :":"Attached documents:",
"Données simulées":"Simulated data",
"Déconnecter":"Sign out",
"Démonstration — parc simulé":"Demo — simulated fleet",
"Désélectionner":"Deselect",
"Détails":"Details",
"ESPACE ADMINISTRATION":"ADMINISTRATION AREA",
"ESPACE DE TRAVAIL":"WORKSPACE",
"Effacer la signature":"Clear signature",
"Effacer les filtres":"Clear filters",
"En retard de":"Overdue by",
"Espace fondateur":"Founder area",
"Export du":"Export of",
"Fiches, QR codes et interventions réunis dans un carnet simple à retrouver.":"Records, QR codes and interventions brought together in a simple logbook that's easy to find.",
"GESTION DE L’ORGANISATION":"ORGANIZATION MANAGEMENT",
"Gardez la maintenance et les accès sous contrôle.":"Keep maintenance and access under control.",
"Historique":"History",
"Hors connexion : les données peuvent être anciennes. L’administration exige le réseau.":"Offline: data may be outdated. Administration requires a network connection.",
"Hors connexion : liste des clients à la dernière connexion. Vous pouvez quand même créer un client, il sera envoyé au retour du réseau.":"Offline: client list as of last connection. You can still create a client; it will be sent when the network returns.",
"Hors connexion · dernier état connu":"Offline · last known state",
"Il sera enregistré automatiquement dès le retour du réseau. Son QR code est déjà définitif : vous pouvez imprimer l'étiquette et saisir des interventions.":"It will be saved automatically as soon as the network returns. Its QR code is already final: you can print the label and enter interventions.",
"Interventions par mois":"Interventions per month",
"Inviter et gérer les rôles":"Invite and manage roles",
"L'équipement sort du parc actif. Sa fiche et tout son historique restent conservés":"The equipment leaves the active fleet. Its record and full history are kept",
"Le client signe avec le doigt dans le cadre ci-dessous.":"The client signs with their finger in the box below.",
"Le passeport numérique de vos équipements — by WiDIAG MQ":"The digital passport for your equipment — by WiDIAG MQ",
"Les actions de gestion, à portée de main":"Management actions, right at your fingertips",
"Les changements s'appliquent aux prochains clients créés avec ce métier.":"Changes apply to the next clients created with this business template.",
"Les données sensibles restent protégées par vos droits d’accès, même hors de cette interface.":"Sensitive data stays protected by your access rights, even outside this interface.",
"Leur histoire, sans détour.":"Their story, no detours.",
"Module rapports":"Reports module",
"Motif :":"Reason:",
"Nom / désignation":"Name / designation",
"Nom de la personne qui a réalisé l'intervention. C'est lui qui figurera":"Name of the person who carried out the intervention. This is the name that will appear",
"Nom du type":"Type name",
"N° de série / immatriculation":"Serial no. / registration",
"Ouvrir en grand":"Open full screen",
"Ouvrir sur un ordinateur":"Open on a computer",
"POUR ALLER PLUS VITE":"TO GET THERE FASTER",
"Par type d'équipement":"By equipment type",
"Parc":"Fleet",
"Parcourir le parc":"Browse the fleet",
"Pas de signature":"No signature",
"Prendre en charge":"Take ownership",
"Proposés quand vous créez un client, et dans « Partir d'un modèle métier » de la page Types.":"Offered when you create a client, and in \"Start from a business template\" on the Types page.",
"Périmètre métier":"Business scope",
"Raccourcis utiles":"Useful shortcuts",
"Rapport d'intervention, pièce remplacée, dégât constaté…":"Intervention report, replaced part, damage found…",
"Rapports":"Reports",
"Rapports & statistiques":"Reports & statistics",
"Reprendre sur ce téléphone":"Resume on this phone",
"Retrouver une fiche équipement":"Find an equipment record",
"Rien d'urgent":"Nothing urgent",
"Rien à signaler pour l'instant.":"Nothing to report for now.",
"Réouvrir":"Reopen",
"Répondre":"Reply",
"SUPPRESSION DÉFINITIVE de":"PERMANENT DELETION of",
"Scanner un QR":"Scan a QR",
"Seront effacés : tous ses comptes, tous ses équipements et tout leur historique d'interventions.":"Will be deleted: all its accounts, all its equipment and their entire intervention history.",
"Si le message parle d'une table introuvable, le fichier SQL « rapports_intervention.sql » n'a pas encore été exécuté dans Supabase.":"If the message mentions a missing table, the SQL file \"rapports_intervention.sql\" has not been run in Supabase yet.",
"Signature du client":"Client signature",
"Statistiques":"Statistics",
"Suivre les opérations du parc":"Track fleet operations",
"Supprimer ce rapport":"Delete this report",
"Supprimer la photo":"Delete the photo",
"Supprimer ma photo de profil":"Delete my profile photo",
"TOUJOURS À JOUR":"ALWAYS UP TO DATE",
"Tapez SUPPRIMER pour confirmer :":"Type SUPPRIMER (the French word) to confirm:",
"Technicien":"Technician",
"Tous les types":"All types",
"Tous les types d'équipement":"All equipment types",
"Tous les équipements":"All equipment",
"Tout archiver":"Archive all",
"Tout ce qui fait tourner votre parc, réuni au même endroit.":"Everything that keeps your fleet running, all in one place.",
"Type d'intervention":"Intervention type",
"Révision annuelle":"Annual service",
"Panne":"Breakdown",
"Installation":"Installation",
"Essais":"Testing",
"Choisir un type…":"Choose a type…",
"Type d'équipement":"Equipment type",
"Types configurés":"Configured types",
"Un parc clair.":"A clear fleet.",
"Une équipe en mouvement.":"A team on the move.",
"VOTRE ORGANISATION":"YOUR ORGANIZATION",
"VOTRE PARC":"YOUR FLEET",
"Voir la fiche":"View record",
"Vos autorisations s’appliquent à chaque action, dans l’interface comme dans la base de données.":"Your permissions apply to every action, in the interface as well as in the database.",
"Vos outils du quotidien":"Your everyday tools",
"Vos équipements.":"Your equipment.",
"Votre modèle métier":"Your business template",
"Votre modèle métier :":"Your business template:",
"Votre organisation, ses équipements et son équipe — au même endroit.":"Your organization, its equipment and its team — all in one place.",
"Vous allez créer l'organisation":"You are about to create the organization",
"Vous pourrez ensuite renommer, ajouter ou retirer des champs librement.":"You can then freely rename, add or remove fields.",
"Vous êtes invité à rejoindre":"You have been invited to join",
"actif":"active",
"administrateur":"administrator",
"ans":"years",
"au total.":"in total.",
"autre":"other",
"ces":"these",
"ces 30 derniers jours":"over the last 30 days",
"champ":"field",
"chez":"at",
"dans la liste active.":"in the active list.",
"demande":"request",
"depuis le":"since",
"en attente":"pending",
"fondateur":"founder",
"fraîchement recréé":"freshly recreated",
"il gérera tout le parc de ce client, pourra modifier":"they will manage this client's entire fleet, can edit",
"interventions enregistrées":"recorded interventions",
"interventions par équipement":"interventions per equipment",
"interventions sur 12 mois. L'export Excel fonctionne comme pour un vrai client.":"interventions over 12 months. The Excel export works just like for a real client.",
"invit.":"inv.",
"jours":"days",
"jusqu'à":"up to",
"le périmètre avant d'envoyer le lien.":"the scope before sending the link.",
"ligne":"line",
"membre":"member",
"membre depuis le":"member since",
"modèle":"template",
"mois":"months",
"nouveau":"new",
"numéro client":"client number",
"obligatoire":"required",
"ou passez par la page Support.":"or go through the Support page.",
"par":"by",
"photos maximum. Elles servent de preuve et restent attachées à l'intervention.":"photos maximum. They serve as proof and stay attached to the intervention.",
"pour la démonstration : un établissement fictif, ses":"for the demo: a fictional facility, its",
"profil":"profile",
"profils":"profiles",
"rapport":"report",
"rapports":"reports",
"saisie":"entry",
"seront effacés.":"will be deleted.",
"suivis":"tracked",
"sur":"on",
"suspendu":"suspended",
"traité":"processed",
"unique à 6 chiffres est attribué automatiquement à l'enregistrement.":"unique 6-digit number is assigned automatically when saved.",
"· Les réponses s’ouvrent dans votre application email.":"· Replies open in your email app.",
"· déjà enregistré":"· already saved",
"». Essayez le n° de série ou la plaque.":"\". Try the serial number or the license plate.",
"À traiter en priorité":"Top priorities",
"Équipe & accès":"Team & access",
"Équipement":"Equipment",
"Équipement introuvable.":"Equipment not found.",
"Équipements les plus sollicités":"Most-used equipment",
"équipements en service":"equipment in service",
"équipements et":"equipment and",
"— Choisir un client —":"— Choose a client —",
"← Retour aux clients":"← Back to clients",
"← Retour à la présentation":"← Back to the presentation",
"⚠️ Retiré du service":"⚠️ Withdrawn from service",
"🖨️ Imprimer l'étiquette":"🖨️ Print the label",
"Accès :":"Access:",
"Accès rétabli":"Access restored",
"Accès suspendu":"Access suspended",
"Accès à la caméra refusé. Autorisez la caméra pour WiTracEQUIP dans les réglages de votre navigateur, puis réessayez.":"Camera access denied. Allow camera access for WiTracEQUIP in your browser settings, then try again.",
"Agenda":"Calendar",
"Ajoutez d'abord un type d'équipement":"Add an equipment type first",
"Ajoutez d’abord un type d’équipement":"Add an equipment type first",
"Applications":"Apps",
"Aucun modèle attribué":"No template assigned",
"Aucun rapport archivé.":"No archived reports.",
"Aucun rapport pour l'instant.":"No reports yet.",
"Aucun type ne vous a été attribué. Contactez votre administrateur.":"No type has been assigned to you. Contact your administrator.",
"Aucun équipement ne correspond.":"No matching equipment.",
"Aucune activité":"No activity",
"Aucune date d’échéance renseignée":"No due date set",
"Aucune intervention enregistrée.":"No interventions recorded.",
"Aucune révision enregistrée.":"No services recorded.",
"Révisions":"Services",
"Type d'historique":"History type",
"Aucune notification archivée":"No archived notifications",
"Aucune nouvelle activité sur votre parc ces 7 derniers jours.":"No new activity on your equipment fleet in the last 7 days.",
"Aucune sélection":"No selection",
"Caractéristiques":"Specifications",
"Ce QR code ne correspond pas à un équipement WiTracEQUIP.":"This QR code doesn't match any WiTracEQUIP equipment.",
"Ce lien d'invitation n'est plus valable. Demandez-en un nouveau à votre administrateur.":"This invitation link is no longer valid. Ask your administrator for a new one.",
"Ce rapport":"This report",
"Ce rapport n'est plus dans la liste : actualisez puis recommencez.":"This report is no longer in the list: refresh and try again.",
"Ces rapports":"These reports",
"Champs supplémentaires (optionnel)":"Additional fields (optional)",
"Chargement":"Loading",
"Choisissez d'abord un client.":"Choose a client first.",
"Choisissez un type d'équipement.":"Choose an equipment type.",
"Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.":"Account created! Check your inbox to confirm your address, then sign in.",
"Comptes créés (":"Accounts created (",
"Confirmation et droits existants":"Existing confirmation and permissions",
"Confirmation par saisie obligatoire":"Typed confirmation required",
"Connexion impossible":"Unable to sign in",
"Connexion requise":"Sign-in required",
"Connexion requise pour les invitations":"Sign-in required for invitations",
"Contactez l'administrateur de votre organisation pour le rétablir.":"Contact your organization's administrator to restore it.",
"Création…":"Creating…",
"Créez un équipement ou préparez d’abord un type de fiche.":"Create an equipment item or set up a record type first.",
"Demandes clôturées · plus récentes d’abord":"Closed requests · newest first",
"Demandeur inconnu":"Unknown requester",
"Dossier client":"Client file",
"Email ou mot de passe incorrect.":"Incorrect email or password.",
"En service":"In service",
"Envoi des photos…":"Uploading photos…",
"Envoyer au support":"Send to support",
"Envoyer par e-mail":"Send by email",
"Fiche":"Record",
"Fiche client enregistrée":"Client record saved",
"Fiche enregistrée":"Record saved",
"Générer le lien":"Generate link",
"Hors connexion : les fonctions d’administration sont indisponibles.":"Offline: administration functions are unavailable.",
"Ils retrouveront":"They will regain",
"Impossible d'accéder à la caméra :":"Unable to access the camera:",
"Impossible de charger les fichiers :":"Unable to load the files:",
"Indicateur":"Metric",
"Interventions par équipement (moyenne)":"Interventions per equipment item (average)",
"L'accès à WiTracEQUIP se fait uniquement sur invitation.":"Access to WiTracEQUIP is by invitation only.",
"L'adresse e-mail indiquée n'est pas valide.":"The email address provided is not valid.",
"L'organisation qui vous invite est actuellement suspendue. Contactez WiDIAG MQ.":"The organization inviting you is currently suspended. Contact WiDIAG MQ.",
"La création de compte se fait uniquement via un lien d'invitation.":"Accounts can only be created through an invitation link.",
"La personne retrouvera":"The person will regain",
"Le chargement prend trop de temps. Vérifiez la connexion puis réessayez.":"Loading is taking too long. Check your connection and try again.",
"Le lecteur de QR code n'a pas pu se charger. Vérifiez votre connexion et réessayez.":"The QR code scanner failed to load. Check your connection and try again.",
"Le mot de passe est copié : vous pouvez le coller dans un SMS ou un mail.":"The password is copied: you can paste it into a text message or an email.",
"Le nom de l'entreprise est obligatoire.":"The company name is required.",
"Le nom de l'intervenant est obligatoire : c'est lui qui engage la traçabilité de la fiche.":"The technician's name is required: it is what establishes the record's traceability.",
"Le nom du type est obligatoire.":"The type name is required.",
"Le nom est obligatoire.":"The name is required.",
"Le type d'intervention est obligatoire (entretien, réparation, contrôle…).":"The intervention type is required (maintenance, repair, inspection…).",
"Lecture du fichier impossible":"Unable to read the file",
"Les 200 demandes les plus récentes sont chargées.":"The 200 most recent requests are loaded.",
"Les actions sont liées à cette organisation.":"Actions are tied to this organization.",
"Les notifications que vous archivez restent consultables ici pendant une semaine.":"Notifications you archive remain available here for one week.",
"Les photos (":"Photos (",
"Les raccourcis respectent les permissions et confirmations de l’application.":"Shortcuts respect the app's permissions and confirmations.",
"Lien créé — transmettez-le à la personne concernée (valable 14 jours).":"Link created — send it to the person concerned (valid for 14 days).",
"Masquer":"Hide",
"Merci de confirmer votre email avant de vous connecter (lien envoyé par email).":"Please confirm your email before signing in (link sent by email).",
"Modifiée par":"Modified by",
"Navigation mobile":"Mobile navigation",
"Nom du client":"Client name",
"Nom du client ou choisir dans la liste":"Client name, or choose from the list",
"Non renseigné":"Not provided",
"Nouveau métier":"New trade",
"Ouvrir une fiche équipement":"Open an equipment record",
"Pas de réseau : client enregistré sur le téléphone. Il sera créé dès le retour du réseau.":"No network: client saved on the phone. It will be created as soon as the network is back.",
"Pas de réseau : la modification d'une fiche client nécessite une connexion.":"No network: editing a client record requires a connection.",
"Pas de réseau : équipement enregistré sur le téléphone. Il sera envoyé dès le retour du réseau.":"No network: equipment saved on the phone. It will be sent as soon as the network is back.",
"Photo de l'intervention":"Intervention photo",
"Photo supprimée":"Photo deleted",
"Prochaine échéance :":"Next due date:",
"Maintenance préventive (optionnel)":"Preventive maintenance (optional)",
"Périodicité":"Frequency",
"Aucune (pas de rappel automatique)":"None (no automatic reminder)",
"Tous les mois":"Every month",
"Tous les 3 mois":"Every 3 months",
"Tous les 6 mois":"Every 6 months",
"Tous les ans":"Every year",
"Tous les 2 ans":"Every 2 years",
"Tous les 5 ans":"Every 5 years",
"Dernière maintenance effectuée":"Last maintenance done",
"Maintenance préventive":"Preventive maintenance",
"Une alerte apparaît sur l'accueil 1 mois avant chaque échéance. Sans date, le décompte démarre aujourd'hui ; chaque intervention enregistrée relance le compteur.":"An alert appears on the home page 1 month before each due date. Without a date, the countdown starts today; each recorded intervention restarts the counter.",
"Précédente":"Previous",
"Raccourcis client":"Client shortcuts",
"Rappel prêt : ouvrez le fichier pour l’ajouter à votre agenda":"Reminder ready: open the file to add it to your calendar",
"Remettre dans les récentes":"Move back to recent",
"Replier":"Collapse",
"Rouvrir la consultation publique":"Reopen public access",
"Réessayez dans un instant, ou reconnectez-vous.":"Try again in a moment, or sign in again.",
"Sans n° de série":"No serial no.",
"Sans sujet":"No subject",
"Ses photos sont supprimées.":"Its photos are deleted.",
"Signature déjà enregistrée (conservée). Pour la remplacer, le client signe à nouveau dans le cadre ci-dessous.":"Signature already saved (kept). To replace it, the client signs again in the box below.",
"Signature enregistrée":"Signature saved",
"Statut":"Status",
"Suivante":"Next",
"Suppression annulée : confirmation incorrecte.":"Deletion cancelled: incorrect confirmation.",
"Synthèse":"Summary",
"Sélectionner ce rapport":"Select this report",
"TOUS les rapports de cette liste":"ALL reports in this list",
"Top 10 — équipements les plus sollicités":"Top 10 — most frequently serviced equipment",
"Tous leurs membres retrouvent l'accès.":"All their members regain access.",
"Type modifié":"Type updated",
"Un":"One",
"Un compte existe déjà avec cet email.":"An account already exists with this email.",
"Un tiroir unique pour vos outils de pilotage.":"A single drawer for your management tools.",
"Valeur":"Value",
"Voir":"View",
"Voir la photo":"View photo",
"Voir les champs":"View fields",
"Voir les modèles":"View templates",
"Votre accès à WiTracEQUIP est actuellement suspendu.":"Your access to WiTracEQUIP is currently suspended.",
"Votre administrateur peut préparer les types de fiches.":"Your administrator can set up the record types.",
"Votre navigateur ne permet pas d'utiliser la caméra ici. Scannez l'étiquette avec l'appareil photo du téléphone à la place.":"Your browser doesn't allow camera use here. Scan the label with your phone's camera app instead.",
"Vous avez reçu un lien d'invitation ? Ouvrez-le pour créer votre compte.":"Received an invitation link? Open it to create your account.",
"Vous fixez le client, le rôle":"You are setting the client, the role",
"Vous modifiez le rapport du":"You are editing the report from",
"Vous êtes à jour":"You're all caught up",
"ainsi que les documents joints (à récupérer depuis « Voir »)":"as well as the attached documents (to retrieve from “View”)",
"archivé(s)":"archived",
"champ(s) personnalisé(s)":"custom field(s)",
"clients supprimés":"clients deleted",
"dans 1 mois —":"in 1 month —",
"dans 1 semaine —":"in 1 week —",
"des équipements créés sur ce téléphone":"equipment created on this phone",
"enregistrés":"saved",
"est déconnecté(e) de tous ses appareils":"is signed out of all their devices",
"la base a refusé la modification (aucune ligne modifiée).":"the database rejected the change (no rows modified).",
"restauré":"restored",
"restauré(s)":"restored",
"restaurés":"restored",
"type(s) d'équipement :":"equipment type(s):",
"type(s) déjà présent(s) seront ignorés.":"type(s) already present will be skipped.",
"Échéance à prévoir pour":"Due date to schedule for",
"à distance ? •":"remote? •",
"équipements restaurés":"equipment restored",
"(retiré du service)":"(taken out of service)",
"(votre entreprise)":"(your company)",
") n'ont pas pu partir : ajoutez-les avec « Modifier » une fois la connexion revenue.":") could not be sent: add them with “Edit” once the connection is back.",
", en moins d'une minute dès que l'appareil capte le réseau. • Les données gardées sur l'ancien appareil sont effacées. •":", within a minute as soon as the device picks up a network signal. • Data kept on the old device is erased. •",
". Les types déjà présents ne sont jamais dupliqués ni écrasés.":". Types that already exist are never duplicated or overwritten.",
". Rien n'est changé tant que vous n'avez pas cliqué sur « Enregistrer les modifications ».":". Nothing is changed until you click “Save changes”.",
". Vous pouvez créer un équipement et saisir des interventions : tout part dès le retour du réseau.":". You can create equipment and enter interventions: everything is sent as soon as the network returns.",
"? Les rapports ne sont pas supprimés : ils restent consultables dans l'onglet « Archivés » et peuvent être restaurés.":"? The reports are not deleted: they remain viewable in the “Archived” tab and can be restored.",
"Archiver ce rapport ? Le rapport n'est pas supprimé : il reste consultable dans l'onglet « Archivés » et peut être restauré.":"Archive this report? The report is not deleted: it remains viewable in the “Archived” tab and can be restored.",
"Attribué par WiDIAG MQ. Pour l'adapter à votre activité, ouvrez un type (« Modifier ») et ajoutez vos propres champs.":"Assigned by WiDIAG MQ. To adapt it to your business, open a type (“Edit”) and add your own fields.",
"Aucun type d'équipement chez ce client : attribuez-lui d'abord un modèle métier.":"This client has no equipment types: assign it a trade template first.",
"Aucun équipement pour ce client. Ajoutez le premier avec « + Équipement ».":"No equipment for this client. Add the first one with “+ Equipment”.",
"Ce client n'a encore aucun type d'équipement : attribuez-lui un modèle métier (Modifier) ou créez un type.":"This client has no equipment types yet: assign it a trade template (Edit) or create a type.",
"Ces champs apparaîtront dans le formulaire d'ajout d'équipement de ce type (ex : marque, modèle, capacité, kilométrage…).":"These fields will appear in the add-equipment form for this type (e.g. brand, model, capacity, mileage…).",
"Client suspendu — accès coupé":"Client suspended — access cut off",
"Créer le métier":"Create trade",
"Créez-en un (ex. « Véhicule », « Dispositif médical », « Équipement industriel »…) pour commencer à ajouter des équipements.":"Create one (e.g. “Vehicle”, “Medical device”, “Industrial equipment”…) to start adding equipment.",
"Déconnecter à distance":"Sign out remotely",
"Enregistrer le rapport":"Save report",
"Fermer la consultation publique":"Close public access",
"Historique et traçabilité":"History and traceability",
"Historique indisponible sans réseau.":"History unavailable offline.",
"L'export Excel contient 3 onglets : Synthèse, Équipements (avec le nombre d'interventions de chacun) et Interventions (tout l'historique). Les photos restent dans l'application.":"The Excel export contains 3 sheets: Summary, Equipment (with the number of interventions for each) and Interventions (the full history). Photos stay in the app.",
"Le modèle crée d'un coup les types d'équipement du secteur chez ce client. Tous ses membres en profiteront.":"The template creates all of the sector's equipment types for this client in one go. All its members will benefit.",
"Membres, rôles et appareils":"Members, roles and devices",
"Modifier le métier":"Edit trade",
"Modifier le rapport":"Edit report",
"Nom de la personne qui a réalisé l'intervention. C'est lui qui figurera sur le carnet en cas de contrôle — pré-rempli avec le vôtre, modifiable si vous saisissez pour un collègue.":"Name of the person who carried out the intervention. This is the name that will appear in the logbook in case of an inspection — pre-filled with yours, editable if you are entering it for a colleague.",
"Nouveau rapport d'intervention":"New intervention report",
"Nouvelle organisation ·":"New organization ·",
"Rapport archivé":"Report archived",
"Rapport chargé : modifiez puis enregistrez":"Report loaded: edit, then save",
"Rapport d'intervention enregistré":"Intervention report saved",
"Rapport modifié":"Report updated",
"Rapport restauré":"Report restored",
"Réactiver le client":"Reactivate client",
"Supprimer ce rapport ? Le rapport, la signature et les documents joints seront définitivement effacés.":"Delete this report? The report, the signature and the attached documents will be permanently erased.",
"Supprimer cette photo ? Elle ne pourra plus servir de preuve pour cette intervention.":"Delete this photo? It will no longer be usable as evidence for this intervention.",
"Suspendre le client":"Suspend client",
"Tous les types de ce modèle sont déjà présents.":"All the types in this template are already present.",
"Tous leurs membres perdent immédiatement l'accès. Rien n'est effacé.":"All their members immediately lose access. Nothing is erased.",
"Type d'équipement créé":"Equipment type created",
"Une trace est conservée dans le journal. Pour une coupure temporaire, préférez « Suspendre ».":"A record is kept in the log. For a temporary cut-off, prefer “Suspend”.",
"aucun type":"no type",
"ce profil":"this profile",
"du client":"of the client",
"en tant que":"as",
"et en devenir l'":"and become its ",
"il gérera tout le parc de ce client, pourra modifier ses membres et supprimer définitivement équipements et interventions. Il voit tous les métiers.":"they will manage this client's entire fleet, be able to edit its members and permanently delete equipment and interventions. They see all trades.",
"la personne":"the person",
"le porte : ses équipements et ses types restent":"holds it: its equipment and types remain",
"le périmètre avant d'envoyer le lien. La personne rejoint l'organisation avec exactement ces droits, sans pouvoir les modifier.":"the scope before sending the link. The person joins the organization with exactly these rights and cannot change them.",
"pourra se reconnecter avec son e-mail et son mot de passe sur un nouvel appareil, qui deviendra son appareil autorisé. Téléphone perdu ou volé : pensez aussi à lui donner un nouveau mot de passe (bouton « Mot de passe »).":"will be able to sign back in with their email and password on a new device, which will become their authorized device. Lost or stolen phone: also remember to give them a new password (“Password” button).",
"s le portent : leurs équipements et leurs types restent":"s hold it: their equipment and types remain",
"un ordinateur":"a computer",
"· par":"· by",
"Équipement créé — son QR code est prêt":"Equipment created — its QR code is ready",
"→ Exécutez d'abord le fichier sql/13-rapports-champs-libres.sql dans Supabase (SQL Editor).":"→ First run the file sql/13-rapports-champs-libres.sql in Supabase (SQL Editor).",
"VOTRE PRIORITÉ":"YOUR PRIORITY",
"Votre priorité":"Your priority",
"Répondre à":"Reply to",
" par email":" by email",
" par e-mail":" by email",
"Supprimer la demande":"Delete request",
"Supprimer la":"Delete the",
"(vous)":"(you)",
"(+1 archivé)":"(+1 archived)",
"archivés":"archived",
"Nouvelles prioritaires · plus anciennes d’abord":"New requests first · oldest first",
"prioritaires · plus anciennes d’abord":"priority · oldest first",
"vous@exemple.com":"you@example.com",
"L'ajout de nouveaux utilisateurs est géré par WiDIAG MQ. Écrivez à":"New users are added by WiDIAG MQ. Write to",
"créé":"created",
"créés":"created",
"supprimé":"deleted",
"supprimés":"deleted",
"ajouté":"added",
"ajoutés":"added",
"enregistré":"saved",
"modifié":"edited",
"modifiés":"edited",
"importé":"imported",
"importés":"imported",
"envoyé":"sent",
"envoyés":"sent",
"créée":"created",
"créées":"created",
"supprimée":"deleted",
"supprimées":"deleted",
"archivée":"archived",
"archivées":"archived",
"restaurée":"restored",
"restaurées":"restored",
"ajoutée":"added",
"ajoutées":"added",
"modifiée":"edited",
"modifiées":"edited",
"enregistrée":"saved",
"enregistrées":"saved"
};

function lireLang(){ try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr'; } catch(e){ return 'fr'; } }
var lang = lireLang();

/* ---------- Dictionnaire : index ---------- */
function norm(s){ return String(s).replace(/[  ]/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(); }
var M = Object.create(null), ML = Object.create(null), frag = [];
Object.keys(D).forEach(function(k){
  var n = norm(k); if(!n) return;
  M[n] = D[k].trim(); ML[n.toLowerCase()] = D[k].trim();
  var mot = /^[a-zà-ÿ'-]+$/.test(n);
  var decore = /^\s|\s$/.test(k) || /[^A-Za-zÀ-ÿ0-9\s]$/.test(n) || /^[^A-Za-zÀ-ÿ0-9\s]/.test(n);
  var SAFE = /^(créée?s?|supprimée?s?|ajoutée?s?|archivée?s?|restaurée?s?|enregistrée?s?|modifiée?s?|importés?|envoyés?)$/;
  if(n.length >= 4 && (!(mot && !decore) || SAFE.test(n))) frag.push(k);
});
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&'); }
var FRAG_RE = null;
function buildFrag(){
  frag.sort(function(a,b){ return b.length - a.length; });
  var parts = frag.map(function(k){
    var core = norm(k), src = '';
    core.split(' ').forEach(function(w,i){ src += (i ? '[\\s\\u00a0\\u202f]+' : '') + esc(w).replace(/'/g,"['’]"); });
    var pre = /^[A-Za-zÀ-ÿ0-9]/.test(core) ? '(?<![\\p{L}\\p{N}])' : '';
    var post = /[A-Za-zÀ-ÿ0-9]$/.test(core) ? '(?![\\p{L}\\p{N}])' : '';
    var lead = /^\s/.test(k) ? '[\\s\\u00a0\\u202f]' : '', trail = /\s$/.test(k) ? '[\\s\\u00a0\\u202f]' : '';
    return (lead ? '' : pre) + lead + src + trail + (trail ? '' : post);
  });
  try { FRAG_RE = new RegExp(parts.join('|'), 'giu'); } catch(e){ FRAG_RE = null; }
}
buildFrag();

function adapterCasse(src, v){
  var lettres = src.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if(lettres.length > 1 && lettres === lettres.toUpperCase()) return v.toUpperCase();
  if(/^[a-zà-ÿ]/.test(src) && /^[A-Z][a-z]/.test(v)) return v.charAt(0).toLowerCase() + v.slice(1);
  return v;
}
var JOURS = { lun:'Mon', mar:'Tue', mer:'Wed', jeu:'Thu', ven:'Fri', sam:'Sat', dim:'Sun', lundi:'Monday', mardi:'Tuesday', mercredi:'Wednesday', jeudi:'Thursday', vendredi:'Friday', samedi:'Saturday', dimanche:'Sunday' };
var MOIS = { janv:'Jan', 'févr':'Feb', mars:'March', avr:'Apr', mai:'May', juin:'June', juil:'Jul', 'août':'Aug', sept:'Sep', oct:'Oct', nov:'Nov', 'déc':'Dec', janvier:'January', 'février':'February', avril:'April', juillet:'July', septembre:'September', octobre:'October', novembre:'November', 'décembre':'December' };
function datesFr(s){
  return s.replace(/(^|[^\p{L}])(lun|mar|mer|jeu|ven|sam|dim|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\.?)(?=\s+\d)/giu, function(m, a, j, pt){ return a + JOURS[j.toLowerCase()]; })
          .replace(/(^|[^\p{L}\p{N}])(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc|janvier|février|avril|juillet|septembre|octobre|novembre|décembre)(\.?)(?=\s+\d{4})/giu, function(m, a, mo, pt){ return a + MOIS[mo.toLowerCase()]; })
          .replace(/(\d)(\s+)(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc|janvier|février|avril|juillet|septembre|octobre|novembre|décembre)(\.?)(?![\p{L}])/giu, function(m, d, sp, mo, pt){ return d + sp + MOIS[mo.toLowerCase()]; });
}
var PAT = [
  [/^il y a (\d+) jours?$/i, function(m,n){ return n + (n === '1' ? ' day ago' : ' days ago'); }],
  [/^il y a (\d+) h$/i, function(m,n){ return n + ' h ago'; }],
  [/^il y a (\d+) min$/i, function(m,n){ return n + ' min ago'; }]
];
var NOMS = { demande:'request', 'équipement':'item', client:'client', intervention:'intervention', rapport:'report', photo:'photo', profil:'profile', type:'type', membre:'member', invitation:'invitation', fiche:'record', 'modèle':'template', champ:'field', document:'document', notification:'notification', utilisateur:'user', appareil:'device', 'établissement':'facility', 'échéance':'due date', 'résultat':'result', 'élément':'item', 'jour':'day', 'semaine':'week', 'mois':'month', 'heure':'hour', 'minute':'minute' };
var NOMS_PL = { 'mois':'months', 'échéance':'due dates' };
function nombres(s){
  return s.replace(/(^|[^\p{L}\p{N}])(\d+)(\s+)(demande|équipement|client|intervention|rapport|photo|profil|type|membre|invitation|fiche|modèle|champ|document|notification|utilisateur|appareil|établissement|échéance|résultat|élément|jour|semaine|mois|heure|minute)(s|x)?(?![\p{L}])/giu, function(m, a, n, sp, nom){
    var k = nom.toLowerCase(), en = NOMS[k] || nom;
    if(n !== '1') en = NOMS_PL[k] || (en + (/(s|ch|sh|x)$/.test(en) ? 'es' : 's'));
    return a + n + sp + en;
  });
}
var INL = [
  [/(^|[^\p{L}])il y a (\d+) jours?(?![\p{L}])/giu, function(m, a, n){ return a + n + (n === '1' ? ' day ago' : ' days ago'); }],
  [/(^|[^\p{L}])il y a (\d+) h(?![\p{L}])/giu, function(m, a, n){ return a + n + ' h ago'; }],
  [/(^|[^\p{L}])il y a (\d+) min(?![\p{L}])/giu, function(m, a, n){ return a + n + ' min ago'; }]
];
var cache = new Map();
function tr(s){
  if(s == null) return s;
  s = String(s);
  if(cache.has(s)) return cache.get(s);
  var out = s, t = s.trim();
  if(t && /[A-Za-zÀ-ÿ]/.test(t)){
    var n = norm(t), v = M[n], done = false;
    if(v === undefined && ML[n.toLowerCase()] !== undefined) v = adapterCasse(n, ML[n.toLowerCase()]);
    if(v !== undefined){ out = s.slice(0, s.indexOf(t)) + v + s.slice(s.indexOf(t) + t.length); done = true; }
    if(!done){
      for(var i = 0; i < PAT.length; i++){
        var m = n.match(PAT[i][0]);
        if(m){ out = s.slice(0, s.indexOf(t)) + PAT[i][1].apply(null, m) + s.slice(s.indexOf(t) + t.length); done = true; break; }
      }
    }
    if(!done && FRAG_RE){
      var pre = s;
      if(/\d/.test(pre)){
        for(var q = 0; q < INL.length; q++) pre = pre.replace(INL[q][0], INL[q][1]);
        pre = datesFr(pre);
      }
      out = pre.replace(FRAG_RE, function(mm){
        var key = norm(mm), val = M[key];
        if(val === undefined && ML[key.toLowerCase()] !== undefined) val = adapterCasse(key, ML[key.toLowerCase()]);
        if(val === undefined) return mm;
        var lead = (mm.match(/^[\s  ]*/) || [''])[0], trail = (mm.match(/[\s  ]*$/) || [''])[0];
        return lead + val + trail;
      });
      if(/\d/.test(out)) out = nombres(out);
    }
  }
  if(cache.size > 6000) cache.clear();
  cache.set(s, out);
  return out;
}

/* ---------- Traduction du DOM ---------- */
var SKIP = 'script,style,textarea,noscript,[data-no-i18n],.support-ticket-message,.support-ticket h3,.vt,[contenteditable="true"]';
var ATTRS = ['placeholder','title','aria-label','alt'];
var TX = new WeakMap(), AX = new WeakMap();

var SKIP_ATTR = SKIP.replace('textarea,', '');
function ignore(el){ return !el || (el.closest && el.closest(SKIP)); }
function ignoreAttr(el){ return !el || (el.closest && el.closest(SKIP_ATTR)); }
function doText(node){
  var p = node.parentElement; if(!p || ignore(p)) return;
  var cur = node.nodeValue, rec = TX.get(node);
  if(rec && rec.t === cur) return;
  var nv = tr(cur);
  if(nv !== cur){ TX.set(node, { o:cur, t:nv }); node.nodeValue = nv; }
  else if(rec) TX.delete(node);
}
function doAttrs(el){
  if(ignoreAttr(el)) return;
  var rec = AX.get(el) || {}, list = ATTRS.slice();
  if(el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) list.push('value');
  list.forEach(function(a){
    if(!el.hasAttribute || !el.hasAttribute(a)) return;
    var cur = el.getAttribute(a), r = rec[a];
    if(r && r.t === cur) return;
    var nv = tr(cur);
    if(nv !== cur){ rec[a] = { o:cur, t:nv }; el.setAttribute(a, nv); }
    else if(r) delete rec[a];
  });
  AX.set(el, rec);
}
function walk(root){
  if(!root) return;
  if(root.nodeType === 3){ doText(root); return; }
  if(root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if(root.nodeType === 1){ if(ignoreAttr(root)) return; doAttrs(root); }
  var tw = document.createTreeWalker(root, 1 | 4, null), n;
  while((n = tw.nextNode())){
    if(n.nodeType === 3) doText(n); else doAttrs(n);
  }
}
function restore(){
  var tw = document.createTreeWalker(document.documentElement, 1 | 4, null), n;
  while((n = tw.nextNode())){
    if(n.nodeType === 3){
      var r = TX.get(n);
      if(r && r.t === n.nodeValue) n.nodeValue = r.o;
      TX.delete(n);
    } else {
      var rec = AX.get(n);
      if(rec) Object.keys(rec).forEach(function(a){
        if(n.getAttribute(a) === rec[a].t) n.setAttribute(a, rec[a].o);
      });
      AX.delete(n);
    }
  }
}

/* ---------- Dates et nombres ---------- */
['toLocaleString','toLocaleDateString','toLocaleTimeString'].forEach(function(nom){
  var o = Date.prototype[nom];
  Date.prototype[nom] = function(loc, opt){
    if(lang === 'en' && typeof loc === 'string' && /^fr/i.test(loc)) loc = 'en-GB';
    return o.call(this, loc, opt);
  };
});
(function(){
  var o = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function(loc, opt){
    if(lang === 'en' && typeof loc === 'string' && /^fr/i.test(loc)) loc = 'en-GB';
    return o.call(this, loc, opt);
  };
})();

/* ---------- Boîtes de dialogue natives ---------- */
['alert','confirm','prompt'].forEach(function(nom){
  var o = window[nom]; if(typeof o !== 'function') return;
  window[nom] = function(msg, def){
    if(lang === 'en') msg = tr(msg);
    return nom === 'prompt' ? o.call(window, msg, def) : o.call(window, msg);
  };
});

/* ---------- Styles ---------- */
(function(){
  var st = document.createElement('style');
  st.textContent =
    '.wte-lang-auth{text-align:center;margin:10px 0}' +
    '.wte-lang-btn{background:none;border:1px solid rgba(127,127,127,.45);border-radius:999px;padding:6px 14px;font:inherit;font-size:13px;color:inherit;cursor:pointer}' +
    '.wte-lang-btn:hover{background:rgba(127,127,127,.12)}' +
    '.wte-lang-inline{margin-left:8px;padding:4px 10px;font-size:12px}' +
    '.wte-trad{margin:8px 0 0;padding:8px 10px;border-left:3px solid currentColor;border-radius:6px;background:rgba(127,127,127,.12);font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}' +
    '.wte-trad b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.75;margin-bottom:4px}' +
    '.wte-trad a{margin-right:12px}';
  document.head.appendChild(st);
})();

/* ---------- Bouton de bascule ---------- */
function libelleBascule(){ return '🌐 ' + (lang === 'en' ? 'Français' : 'English'); }
function titreBascule(){ return lang === 'en' ? 'Passer en français' : 'Switch to English'; }
function fabriqueBascule(cls){
  var b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.setAttribute('data-wte-lang', '1'); b.setAttribute('data-no-i18n', '');
  b.textContent = libelleBascule(); b.title = titreBascule(); b.setAttribute('aria-label', titreBascule());
  return b;
}
function injecterBascule(){
  var btns = document.querySelectorAll('[data-wte-lang]');
  for(var i = 0; i < btns.length; i++){
    if(btns[i].textContent !== libelleBascule()){
      btns[i].textContent = libelleBascule(); btns[i].title = titreBascule(); btns[i].setAttribute('aria-label', titreBascule());
    }
  }
  var dd = document.getElementById('user-dropdown');
  if(dd && !dd.querySelector('[data-wte-lang]')){
    var sortie = dd.querySelector('[data-action="logout"]');
    var b = fabriqueBascule('wte-lang-item');
    if(sortie) sortie.parentNode.insertBefore(b, sortie); else dd.appendChild(b);
  }
  var logo = document.querySelector('.auth-logo');
  if(logo && !dd && !document.querySelector('.wte-lang-auth')){
    var w = document.createElement('div'); w.className = 'wte-lang-auth';
    w.appendChild(fabriqueBascule('wte-lang-btn'));
    logo.parentNode.insertBefore(w, logo.nextSibling);
  }
  var pub = document.querySelector('.pub-connexion');
  if(pub && !pub.parentNode.querySelector('[data-wte-lang]')){
    pub.parentNode.insertBefore(fabriqueBascule('wte-lang-btn wte-lang-inline'), pub.nextSibling);
  }
}

/* ---------- Support (fondateur) : traduire une demande en anglais ---------- */
var tradCache = {};
function libTrad(){ return '🌐 ' + (lang === 'en' ? 'Translate to English' : 'Traduire en anglais'); }
function idTicket(art){
  var b = art.querySelector('[data-id]'); return b ? b.getAttribute('data-id') : null;
}
function boiteTrad(id, art){
  var r = tradCache[id]; if(!r) return;
  var msgEl = art.querySelector('.support-ticket-message'); if(!msgEl) return;
  var ex = art.querySelector('.wte-trad');
  if(ex) return;
  var box = document.createElement('div'); box.className = 'wte-trad'; box.setAttribute('data-no-i18n', '');
  var h = document.createElement('b');
  h.textContent = r.ok ? (lang === 'en' ? 'Automatic translation (English)' : 'Traduction automatique (anglais)')
                       : (lang === 'en' ? 'Translation' : 'Traduction');
  box.appendChild(h);
  if(r.ok){
    var t = document.createElement('div');
    t.textContent = (r.sujet ? r.sujet + '\n\n' : '') + r.message;
    box.appendChild(t);
  } else {
    var p = document.createElement('div');
    p.textContent = lang === 'en'
      ? 'On-device translation is not available in this browser (recent desktop Chrome or Edge). Open the message in a translator (opens only when you click):'
      : 'La traduction intégrée n’est pas disponible dans ce navigateur (Chrome ou Edge récent sur ordinateur). Ouvrir le message dans un traducteur (ne s’ouvre qu’au clic) :';
    box.appendChild(p);
    var texte = (r.sujet ? r.sujet + '\n\n' : '') + r.message;
    [['DeepL', 'https://www.deepl.com/translator#fr/en/' + encodeURIComponent(texte)],
     ['Google Translate', 'https://translate.google.com/?sl=fr&tl=en&op=translate&text=' + encodeURIComponent(texte)]].forEach(function(l){
      var a = document.createElement('a'); a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = l[0];
      box.appendChild(a);
    });
  }
  msgEl.parentNode.insertBefore(box, msgEl.nextSibling);
}
function injecterSupport(){
  var arts = document.querySelectorAll('.support-ticket');
  for(var i = 0; i < arts.length; i++){
    var art = arts[i], id = idTicket(art); if(!id) continue;
    var zone = art.querySelector('.support-ticket-actions'); if(!zone) continue;
    var b = zone.querySelector('[data-wte-trad]');
    if(!b){
      b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm';
      b.setAttribute('data-wte-trad', id); b.setAttribute('data-no-i18n', '');
      zone.insertBefore(b, zone.firstChild);
    }
    if(b.textContent !== libTrad()) b.textContent = libTrad();
    if(tradCache[id]) boiteTrad(id, art);
    else { var ex = art.querySelector('.wte-trad'); if(ex) ex.remove(); }
  }
}
async function traduireMachine(textes, btn){
  try {
    var T = self.Translator;
    if(T && typeof T.create === 'function'){
      var opts = { sourceLanguage:'fr', targetLanguage:'en' };
      var av = await T.availability(opts);
      if(av !== 'unavailable'){
        var travail = (async function(){
          var t = await T.create({ sourceLanguage:'fr', targetLanguage:'en', monitor:function(m){
            m.addEventListener('downloadprogress', function(e){ if(btn) btn.textContent = Math.round((e.loaded || 0) * 100) + ' %'; });
          } });
          var out = [];
          for(var i = 0; i < textes.length; i++) out.push(textes[i] ? await t.translate(textes[i]) : '');
          return out;
        })();
        var limite = new Promise(function(res){ setTimeout(function(){ res(null); }, av === 'available' ? 20000 : 120000); });
        return await Promise.race([travail, limite]);
      }
    }
  } catch(e){}
  return null;
}
async function cliquerTrad(btn){
  var id = btn.getAttribute('data-wte-trad'), art = btn.closest('.support-ticket'); if(!art) return;
  if(tradCache[id]){ delete tradCache[id]; var ex = art.querySelector('.wte-trad'); if(ex) ex.remove(); return; }
  var sujet = (art.querySelector('h3') || {}).textContent || '', message = (art.querySelector('.support-ticket-message') || {}).textContent || '';
  btn.disabled = true; var ancien = btn.textContent; btn.textContent = '…';
  var out = await traduireMachine([sujet, message], btn);
  btn.disabled = false; btn.textContent = ancien;
  tradCache[id] = out ? { ok:true, sujet:out[0], message:out[1] } : { ok:false, sujet:sujet, message:message };
  injecterSupport();
}

/* ---------- Observation ---------- */
var obs = null;
function observer(){ if(obs) obs.observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS.concat(['value']) }); }
function lot(recs){
  obs.disconnect();
  try {
    if(lang === 'en'){
      for(var i = 0; i < recs.length; i++){
        var r = recs[i];
        if(r.type === 'childList'){ for(var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]); }
        else if(r.type === 'characterData') doText(r.target);
        else if(r.type === 'attributes') doAttrs(r.target);
      }
    }
    injecterBascule(); injecterSupport();
  } catch(e){ try { console.warn('[i18n]', e); } catch(_){} }
  observer();
}
function changerLangue(l){
  lang = l === 'en' ? 'en' : 'fr';
  try { localStorage.setItem(KEY, lang); } catch(e){}
  document.documentElement.lang = lang;
  if(obs) obs.disconnect();
  if(lang === 'en') walk(document.documentElement); else restore();
  injecterBascule(); injecterSupport();
  observer();
}
document.addEventListener('click', function(e){
  var t = e.target && e.target.closest ? e.target.closest('[data-wte-lang],[data-wte-trad]') : null;
  if(!t) return;
  if(t.hasAttribute('data-wte-lang')){ e.preventDefault(); changerLangue(lang === 'en' ? 'fr' : 'en'); }
  else { e.preventDefault(); cliquerTrad(t); }
}, true);

function demarrer(){
  obs = new MutationObserver(lot);
  document.documentElement.lang = lang;
  if(lang === 'en') walk(document.documentElement);
  injecterBascule(); injecterSupport();
  observer();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

window.wteI18n = { langue:function(){ return lang; }, changer:changerLangue, t:tr };
} catch(err){ try { console.warn('[i18n] désactivé :', err); } catch(_){} }
})();
