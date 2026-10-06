# Lot 2 — Éléments attendus, Gates, critères automatiques

Additif par rapport au Lot 1 (à déployer d'abord ou en même temps). Aucune donnée existante n'est modifiée.

## Schéma (ajouts uniquement)
- `Action`, `Risk`, `Decision`, `Deliverable`, `Kpi` : colonne optionnelle `initiativeStageId` (rattachement à l'étape).
- `InitiativeStage.expected` (JSON) : copie figée des éléments attendus du modèle.
- `StageGateDecision` : historique append-only des décisions de Gate (date, utilisateur, décision, commentaire), relié à une `Decision` HPH existante.

## Ce qui est livré
- **Éléments attendus par « Modèle × Étape »** (livrable, action, décision, risque type, indicateur, rôle, information) : édition dans l'éditeur de modèle, copie figée à la création de l'initiative. Sur la page d'étape, « Créer » génère l'objet HPH réel (Livrable, Action, Décision, Risque, Indicateur) rattaché à l'étape — aucun doublon, aucun risque ni indicateur créé automatiquement.
- **Gates** consultatif (alerte, passage possible) ou bloquant, par étape. Conditions : critères obligatoires satisfaits, aucun risque bloquant ouvert, livrables et décisions obligatoires disponibles. Décision GO / GO avec réserves / NO GO (commentaire obligatoire hors GO), historisée, avec création d'une Décision HPH ; GO avance à l'étape suivante.
- **Garde de phase** : le changement manuel de phase vers l'avant est refusé (409) uniquement si le Gate de l'étape courante est bloquant et non satisfait.
- **Critères automatiques / hybrides** : 6 sources (risques bloquants, anomalies bloquantes, actions en retard, livrables / décisions / actions obligatoires de l'étape), recalculées à l'ouverture de la page d'étape. Auto : suit la source. Hybride : propose « prêt », ne rétrograde jamais.
- **Contenu de départ** : éléments attendus, rôles et Gates pour Kick-off, Cadrage, Préparation, Validation (Déploiement, Migration, Interopérabilité, Cybersécurité, Réglementaire), Formation, Mise en production, Stabilisation, Plan d'actions, Restitution, Clôture. Gates bloquants : validation cybersécurité, réglementaire, protection des données ; consultatif : mise en production.
- Les modèles standards déjà semés au Lot 1 sont enrichis par la même route de seed, uniquement s'ils n'ont aucune initiative rattachée et aucun élément (jamais d'écrasement).

## À savoir
- Les initiatives migrées au Lot 1 n'ont pas d'éléments attendus ni de Gate (leur copie est figée) : seules les initiatives créées après le Lot 2 en bénéficient.
- Un critère « automatique » repasse à la valeur de sa source à chaque ouverture de la page d'étape (clic manuel ignoré) ; utiliser « hybride » pour garder la main.
- Pas encore : règles d'activation d'étape par profil de projet, Gate appliqué aux étapes des 8 pages dédiées du Déploiement (Kick-off, Préparation, Validation…), éditeur de parcours par glisser-déposer.
