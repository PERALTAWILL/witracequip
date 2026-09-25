# Proposition : Tour de contrôle mobile Fondateur — non intégrée

Cette direction visuelle 02 (bleu nuit, or, listes et cartes de pilotage) avait été retenue initialement pour le compte principal Fondateur. **Depuis la validation du 25 septembre 2026, c'est le langage visuel HORIZON qui est choisi pour le Fondateur** ; la Tour de contrôle reste la référence pour les raccourcis d'action. Les comptes utilisateur standard gardent l'approche claire de la direction 01, adaptée à leurs droits. Les images utilisent des valeurs fictives : elles ne chargent aucun compte ni aucune donnée réelle.

## Navigation conseillée, sans fonction perdue

| Repère mobile | Destination / action existante |
| --- | --- |
| Pilotage | Accueil Fondateur `#/` et ses compteurs existants : clients, profils actifs, interventions du mois, support à traiter |
| Clients | `#/reglages/clients`, recherche/tri et ouverture de `#/reglages/clients/:id` |
| Créer (bouton +) | Selon le contexte et avec le nom du client visible : `nouveau-client`, `nouvel-equip-client`, `toggle-invite-client` ; le scan QR reste aussi visible sur l'accueil |
| Support | `#/reglages/support` avec son compteur de demandes à traiter |
| Tout → Équipes et historique | `#/reglages/profils`, `#/reglages/journal` |
| Tout → Outils | `#/reglages/support/rapports`, `#/reglages/support/stats`, `#/reglages/support/modeles`, `ouvrir-scanner` |
| Fiche client | Onglets proposés Fiche / Parc / Équipe / Invitations. Conserver `modifier-client`, `submit-client`, `fermer-client-form`, la gestion des membres/accès, les invitations, la recherche/archives du parc et les types `#/types/:id`. |
| Équipement | Garder `#/equip/:id` : QR et impression, consultations publiques, interventions, modification, archivage et suppression selon les droits. |
| Accès & sécurité d'un client | `clients-statut` et `clients-supprimer`, avec les confirmations et protections actuelles. Ne pas autoriser les actions sur sa propre organisation lorsque la règle les interdit. |

## Règles de sécurité et de fonctionnement

- L'habillage « Fondateur » et cette navigation doivent être réservés au véritable compte principal (`isSuperAdmin()`), pas à tous les administrateurs d'organisations clientes. La présentation ne change jamais les autorisations serveur ni les règles RLS.
- La barre basse est destinée aux tâches fréquentes ; « Tout » contient les chemins restants **visibles et nommés**, pas un fourre-tout inaccessible. Dans une fiche client, le contexte de l'organisation doit rester affiché avant toute création, invitation ou suspension.
- Le service worker existant démarre l'application sans réseau et certains ajouts d'équipements/interventions ont une file locale. Cela **ne signifie pas** que l'administration des clients, des rôles ou du support fonctionne hors connexion : signaler clairement l'état réseau et bloquer les opérations qui exigent le serveur. N'afficher « En ligne » que si cela a été effectivement vérifié lors d'une future intégration.
- Préserver les confirmations destructrices, le journal et les retours d'erreur ; tester l'authentification mobile et l'ouverture de l'ordinateur par QR, sans contourner les dispositifs existants.

Les trois écrans `tour-controle-fondateur.html` et l'image complémentaire du menu « Créer pour ce client » sont des **illustrations HTML/CSS statiques**. Leurs touches ne sont reliées à aucune action métier. Aucune intégration ne doit être faite avant validation du parcours par l'utilisateur.
