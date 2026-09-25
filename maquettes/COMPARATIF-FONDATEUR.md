# Comparatif mobile Fondateur — décision à valider

Ces planches mettent côte à côte les deux **maquettes non intégrées**. Toutes les valeurs, organisations et commandes visibles sur les captures sont fictives ; ni la navigation ni les boutons de ces pages comparatives ne sont reliés aux actions métier.

| Critère | A · Tour de contrôle 02 | B · HORIZON |
| --- | --- | --- |
| Premier regard | Quatre indicateurs et une demande prioritaire : dense, très opérationnel. | La demande prioritaire ressort sur une carte claire ; trois autres indicateurs distincts, plus d'espace. |
| Création | Bouton « + » central, toujours visible. | Grand bouton « Commandes » libellé, également persistant. |
| Navigation globale | Cinq entrées : Pilotage, Clients, Créer, Support, Tout. | Quatre entrées : Vue, Clients, Support, Outils ; actions dans une palette séparée. |
| Fiche client | Équipement, Inviter, Types et Modifier directement visibles ; deux équipements récents. | Trois équipements visibles avec recherche/filtres ; mêmes actions dans une palette contextuelle. |
| Risque d'erreur | Numéro du client visible dans la feuille « Créer ». | Nom du client rappelé dans l'en-tête et la palette. |
| Administration sensible | Accès & sécurité séparé. | Accès & sécurité séparé dans la palette ; dans les deux cas, confirmations et droits doivent rester. |

**Recommandation de travail (non validée)** : retenir la hiérarchie visuelle HORIZON, mais garder deux raccourcis directs de la Tour de contrôle sur la fiche client (Équipement et Inviter). Laisser la palette aux opérations moins fréquentes, garder Support et le scanner QR en accès rapide, le nom du client visible avant chaque action, et les quatre onglets Fiche/Parc/Équipe/Invitations. Cette fusion ne doit être dessinée puis intégrée qu'après accord de l'utilisateur.

Les pages actives et les scripts métier restent inchangés par ce comparatif. La réalisation éventuelle doit conserver tous les chemins et droits documentés dans `PLAN-TOUR-CONTROLE.md` et `PLAN-HORIZON.md`, distinguer le vrai Fondateur (`isSuperAdmin()`) des comptes standard, gérer les états réseau (administration en ligne), préserver la file hors ligne existante là où elle existe, et tester les actions destructrices avec leurs confirmations et le journal.
