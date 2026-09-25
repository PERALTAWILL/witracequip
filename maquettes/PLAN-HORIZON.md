# HORIZON — direction visuelle intégrée pour le Fondateur

**Décision du 25 septembre 2026 :** la direction HORIZON a été validée après comparaison avec la Tour de contrôle 02, puis son intégration autorisée sous réserve de conserver les fonctionnalités. Le parcours complémentaire (actions directes « Nouvel équipement » et « Inviter un membre ») est désormais intégré. Seul le véritable super-administrateur de la plateforme reçoit ce thème ; les comptes clients standard gardent leur interface Clarté.

HORIZON garde le même bleu nuit et or, avec une hiérarchie plus calme, une grande carte de priorité, des chiffres non redondants, une barre flottante à **quatre destinations** et une palette d'actions contextuelles persistante. Les écrans et les données de démonstration sont entièrement fictifs. La Tour de contrôle 02 demeure une référence pour la rapidité des actions ; son comparatif figure dans `COMPARATIF-FONDATEUR.md`.

## Accès aux fonctions existantes

| Position proposée | Destination / comportement à préserver après validation |
| --- | --- |
| Vue | `#/`, indicateurs déjà disponibles : nombre de clients, profils actifs, interventions du mois, demandes de support à traiter |
| Clients | `#/reglages/clients` (recherche/tri/nouveau client), puis `#/reglages/clients/:id` |
| Support | `#/reglages/support`, badge basé sur les demandes non traitées |
| Outils | `#/reglages/profils`, `#/reglages/journal`, `#/reglages/support/rapports`, `#/reglages/support/stats`, `#/reglages/support/modeles` et `ouvrir-scanner` |
| Commandes depuis Vue | Palette de raccourcis vers les actions et routes existantes : création d'un client, portefeuille, scanner QR, profils et journal. Aucune recherche de commandes fictive n'est annoncée. |
| Raccourcis sur la fiche client | Nom et numéro visibles avant d'agir : `nouvel-equip-client` (Nouvel équipement) et `fondateur-inviter-client` (ouvre le formulaire d'invitation existant). Les quatre onglets Fiche / Parc / Équipe / Invitations font défiler les sections sans détruire les formulaires. |
| Autres commandes du client | Types `#/types/:organisation`, `modifier-client`/`submit-client`/`fermer-client-form`, puis `clients-statut`/`clients-supprimer` dans une palette sécurisée ; les confirmations et les droits métier existants restent appliqués. |
| Parc et équipement | Garder recherche/archives, chaque route `#/equip/:id`, QR/impression, interventions, modification, archivage/suppression et leurs droits |

## Garde-fous appliqués pendant l'intégration

- L'interface exclusive doit être réservée au vrai compte principal Fondateur (`isSuperAdmin()`), pas aux administrateurs des organisations clientes. Les comptes standard gardent la piste Clarté 01, adaptée à leurs permissions.
- Les onglets client doivent préserver les saisies en cours ; les grandes cibles tactiles, les retours de chargement et les ouvertures de palette doivent rester accessibles au clavier et en mode « réduire les animations ». Les animations CSS de la maquette ne branchent aucune logique métier.
- Les privilèges restent vérifiés par les services existants et les règles RLS ; confirmer les opérations destructrices et conserver la traçabilité. Aucun nouveau pouvoir n'est créé par l'habillage.
- Afficher « En ligne » seulement après vérification réelle lors d'une intégration. Le service worker sait démarrer l'application hors réseau, et certaines créations d'équipements/interventions ont une file locale ; ne **pas** promettre l'administration clients, rôles ou support hors connexion.
- Dans Profils et Équipe, préserver aussi les fonctions moins visibles : modification de rôle, choix des accès, déplacement/renommage de membre, réinitialisation du mot de passe, suspension et libération d’appareil. Dans Support, garder les sous-vues, et dans chaque équipement les liens publics et l'impression du QR.
- Ne jamais remplacer les routes, les actions métier ou les états offline par la navigation illustrative de cette maquette. Tests fonctionnels bureau/téléphone nécessaires avant déploiement.

## Implémentation et vérification

- `css/fondateur.css` définit le socle de couleurs exclusif au Fondateur ; `css/horizon.css` porte les vues responsives. `js/fondateur-view.js` compose la Vue, les Outils, l'en-tête client et la palette. Les routes, services et contrôles restent dans l'application JavaScript d'origine. `sw.js` version `wte-v2.18.0` précharge les nouveaux fichiers.
- La palette native `<dialog>` est hors de la zone redessinée par l'application : elle résiste aux rafraîchissements asynchrones ; Échap et le bouton Fermer la ferment. Le bouton flottant mobile est dans le shell (hors du `<main>` animé) pour rester réellement visible. Le scanner est rendu dans ce même shell et réattache son flux après un réaffichage.
- Vérifications dans Chromium, avec **session et données simulées** : affichage et largeur sans débordement sur 320, 375, 390, 768, 880, 900, 1024 et 1440 px ; navigation des sections, créations/modifications de clients, invitation administrateur confirmée, confirmation de suppression, droits standard, palette et scanner. Rechargement de l'application sans réseau via le service worker et précache des fichiers essentiels vérifiés.
- **Limite de validation :** les écritures des parcours de test ont été simulées ; ni l'authentification Supabase réelle, ni les règles RLS sur un compte de production, ni une caméra physique n'ont été testées. Les SQL, services métier et autres comptes n'ont pas été modifiés.

Les captures `horizon-integre-*.png` montrent l'application réellement rendue dans Chromium avec des données fictives (Vue, dossier, commandes, nouveau client, Outils et bureau). À l'inverse, `horizon-fondateur.html`, `horizon-parcours-fondateur.html` et leurs PNG restent des références de présentation autonomes ; ils ne sont pas chargés par l'application active.
