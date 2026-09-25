# HORIZON — proposition mobile Fondateur B (sans intégration)

Une autre direction visuelle que la Tour de contrôle déjà montrée : même bleu nuit et or, hiérarchie plus calme, grande carte de priorité, chiffres non redondants, barre flottante à **quatre destinations** et palette d'actions contextuelles persistante. Les écrans et les données de démonstration sont entièrement fictifs. La direction 02 précédente reste intacte pour un comparatif demandé **ultérieurement**.

## Accès aux fonctions existantes

| Position proposée | Destination / comportement à préserver après validation |
| --- | --- |
| Vue | `#/`, indicateurs déjà disponibles : nombre de clients, profils actifs, interventions du mois, demandes de support à traiter |
| Clients | `#/reglages/clients` (recherche/tri/nouveau client), puis `#/reglages/clients/:id` |
| Support | `#/reglages/support`, badge basé sur les demandes non traitées |
| Outils | `#/reglages/profils`, `#/reglages/journal`, `#/reglages/support/rapports`, `#/reglages/support/stats`, `#/reglages/support/modeles` et `ouvrir-scanner` |
| Commandes depuis Vue | Palette de raccourcis vers les actions et routes déjà présentes : `nouveau-client`, recherche clients, scanner QR ; **la recherche de commandes** est une idée d'interface, pas un service existant |
| Commandes depuis un client | Toujours montrer son nom/numéro avant d'agir : `nouvel-equip-client`, `toggle-invite-client`, types `#/types/:organisation`, `modifier-client`/`submit-client`/`fermer-client-form`, puis `clients-statut`/`clients-supprimer` dans une section sécurisée |
| Parc et équipement | Garder recherche/archives, chaque route `#/equip/:id`, QR/impression, interventions, modification, archivage/suppression et leurs droits |

## Garde-fous si cette piste est retenue

- L'interface exclusive doit être réservée au vrai compte principal Fondateur (`isSuperAdmin()`), pas aux administrateurs des organisations clientes. Les comptes standard gardent la piste Clarté 01, adaptée à leurs permissions.
- Les onglets client doivent préserver les saisies en cours ; les grandes cibles tactiles, les retours de chargement et les ouvertures de palette doivent rester accessibles au clavier et en mode « réduire les animations ». Les animations CSS de la maquette ne branchent aucune logique métier.
- Les privilèges restent vérifiés par les services existants et les règles RLS ; confirmer les opérations destructrices et conserver la traçabilité. Aucun nouveau pouvoir n'est créé par l'habillage.
- Afficher « En ligne » seulement après vérification réelle lors d'une intégration. Le service worker sait démarrer l'application hors réseau, et certaines créations d'équipements/interventions ont une file locale ; ne **pas** promettre l'administration clients, rôles ou support hors connexion.
- Dans Profils et Équipe, préserver aussi les fonctions moins visibles : modification de rôle, choix des accès, déplacement/renommage de membre, réinitialisation du mot de passe, suspension et libération d’appareil. Dans Support, garder les sous-vues, et dans chaque équipement les liens publics et l'impression du QR.
- Ne jamais remplacer les routes, les actions métier ou les états offline par la navigation illustrative de cette maquette. Tests fonctionnels bureau/téléphone nécessaires avant déploiement.

Fichiers de présentation : `horizon-fondateur.html`, `horizon-fondateur.css` et les PNG `horizon-fondateur-*.png`. Ils ne sont chargés par aucun écran actif. Attendre l'avis de l'utilisateur, puis réaliser le comparatif avec la Tour de contrôle ; ne pas intégrer avant une validation explicite.
