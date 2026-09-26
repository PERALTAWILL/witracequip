# Maquette iPhone Business — plan d'intégration (non appliqué)

Cette maquette est autonome. Elle ne charge pas `index.html`, Supabase, le service worker ni les scripts métier. Ses chiffres et coordonnées sont fictifs. Les clics de démonstration ne modifient aucune donnée.

## Correspondance avec les actions existantes

| Emplacement proposé | Action existante à conserver |
| --- | --- |
| Navigation principale | `#/`, `#/reglages/clients`, `#/reglages/profils`, `#/reglages/support`, `#/reglages/journal` |
| Fiche · « Modifier la fiche » | `modifier-client` |
| Fiche · « Enregistrer » / « Annuler » | `submit-client` / `fermer-client-form` |
| Fiche · Modèle métier | `client-modele` et logique actuelle de création des types |
| Parc · Types / Ajouter | route `#/types/:organisation` / `nouvel-equip-client` |
| Parc · Rechercher / Archivés / Ouvrir | `recherche-parc` / `parc-archives` / route `#/equip/:id` |
| Équipe · Gérer | actions déjà présentes pour rôle, accès, appareil, mot de passe et suspension du membre |
| Invitations · Générer / Annuler | `toggle-invite-client`, formulaire d'invitation et annulation actuels |
| Administration · Suspendre / Supprimer | `clients-statut` / `clients-supprimer`, avec confirmations et droits serveur inchangés |
| Fiche équipement ouverte depuis Parc | QR, impression, interventions, modification, archivage et suppression existants |

## Garde-fous pour une intégration ultérieure

- Conserver les contrôles d'autorisation existants (`isSuperAdmin`, rôles, RLS Supabase) : l'habillage ne confère aucun droit.
- Ne pas supprimer les confirmations des actions destructrices ni modifier les appels aux services de données.
- Préserver la saisie en cours lors du changement d'onglet et garder les commandes clavier accessibles.
- Tester bureau et mobile, notamment formulaires, listes, scanner, QR et utilisation hors ligne, avant tout déploiement.