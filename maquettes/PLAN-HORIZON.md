# HORIZON — direction visuelle Fondateur validée (sans intégration)

**Décision du 25 septembre 2026 :** l'utilisateur valide la **direction visuelle HORIZON pour le compte principal Fondateur** après comparaison avec la Tour de contrôle 02. Cette validation ne porte pas encore sur le détail des raccourcis client, sur la navigation ni sur l'intégration dans l'application. La maquette complémentaire `horizon-parcours-fondateur.html` propose deux actions directes sur la fiche ; elle reste soumise à son avis. Les comptes standard conservent la direction Clarté 01.

HORIZON garde le même bleu nuit et or, avec une hiérarchie plus calme, une grande carte de priorité, des chiffres non redondants, une barre flottante à **quatre destinations** et une palette d'actions contextuelles persistante. Les écrans et les données de démonstration sont entièrement fictifs. La Tour de contrôle 02 demeure une référence pour la rapidité des actions ; son comparatif figure dans `COMPARATIF-FONDATEUR.md`.

## Accès aux fonctions existantes

| Position proposée | Destination / comportement à préserver après validation |
| --- | --- |
| Vue | `#/`, indicateurs déjà disponibles : nombre de clients, profils actifs, interventions du mois, demandes de support à traiter |
| Clients | `#/reglages/clients` (recherche/tri/nouveau client), puis `#/reglages/clients/:id` |
| Support | `#/reglages/support`, badge basé sur les demandes non traitées |
| Outils | `#/reglages/profils`, `#/reglages/journal`, `#/reglages/support/rapports`, `#/reglages/support/stats`, `#/reglages/support/modeles` et `ouvrir-scanner` |
| Commandes depuis Vue | Palette de raccourcis vers les actions et routes déjà présentes : `nouveau-client`, recherche clients, scanner QR ; **la recherche de commandes** est une idée d'interface, pas un service existant |
| Raccourcis sur la fiche client (parcours proposé, non validé) | Toujours montrer son nom/numéro avant d'agir : `nouvel-equip-client` (Nouvel équipement) et `toggle-invite-client` (Inviter un membre). Garder les onglets Fiche / Parc / Équipe / Invitations. |
| Autres commandes du client (palette proposée) | Types `#/types/:organisation`, `modifier-client`/`submit-client`/`fermer-client-form`, puis `clients-statut`/`clients-supprimer` dans une section sécurisée avec confirmations et droits existants. |
| Parc et équipement | Garder recherche/archives, chaque route `#/equip/:id`, QR/impression, interventions, modification, archivage/suppression et leurs droits |

## Garde-fous pour une éventuelle intégration

- L'interface exclusive doit être réservée au vrai compte principal Fondateur (`isSuperAdmin()`), pas aux administrateurs des organisations clientes. Les comptes standard gardent la piste Clarté 01, adaptée à leurs permissions.
- Les onglets client doivent préserver les saisies en cours ; les grandes cibles tactiles, les retours de chargement et les ouvertures de palette doivent rester accessibles au clavier et en mode « réduire les animations ». Les animations CSS de la maquette ne branchent aucune logique métier.
- Les privilèges restent vérifiés par les services existants et les règles RLS ; confirmer les opérations destructrices et conserver la traçabilité. Aucun nouveau pouvoir n'est créé par l'habillage.
- Afficher « En ligne » seulement après vérification réelle lors d'une intégration. Le service worker sait démarrer l'application hors réseau, et certaines créations d'équipements/interventions ont une file locale ; ne **pas** promettre l'administration clients, rôles ou support hors connexion.
- Dans Profils et Équipe, préserver aussi les fonctions moins visibles : modification de rôle, choix des accès, déplacement/renommage de membre, réinitialisation du mot de passe, suspension et libération d’appareil. Dans Support, garder les sous-vues, et dans chaque équipement les liens publics et l'impression du QR.
- Ne jamais remplacer les routes, les actions métier ou les états offline par la navigation illustrative de cette maquette. Tests fonctionnels bureau/téléphone nécessaires avant déploiement.

Fichiers de présentation : `horizon-fondateur.html`, `horizon-fondateur.css`, `horizon-parcours-fondateur.html` et sa feuille CSS, ainsi que les PNG correspondants. Ils ne sont chargés par aucun écran actif. Le comparatif a été réalisé ; ne pas intégrer avant une validation explicite du parcours et de l'intégration.
