# Objectifs & conformité — diffusion groupe → établissements et plan d'action

Additif (nouvelles colonnes à valeur par défaut, aucune suppression). Déployer avec les Lots 1 et 2 ou après.

## Diffusion
- À la création d'un **plan** ou d'un **objectif** de groupe, une question de portée : « Groupe et établissements rattachés (N) » (par défaut) ou « Groupe seulement ». Un élément déjà créé peut être diffusé ensuite (bouton « Diffuser aux établissements »).
- Chaque établissement reçoit une copie **verrouillée** (libellé, description ; pour un plan : libellé, dates, statut). Toute modification faite par le groupe est répercutée. Côté établissement, une tentative de modification renvoie un refus explicite.
- Quand l'objectif et le plan sont tous deux diffusés, leur déclinaison est créée **vide** dans chaque établissement : **cible, indicateurs et statut sont propres à l'établissement** (jamais écrasés).
- Un **nouvel établissement** reçoit automatiquement ce que son groupe diffuse. Bouton « Resynchroniser les établissements » (idempotent) pour rattraper un cas manqué.
- Sur la page du groupe : colonne « Établissements » = nombre de cibles renseignées / établissements.
- Une diffusion ne peut pas être retirée (les établissements gardent leur copie) : décision volontaire pour ne rien supprimer.
- Hors périmètre : les exigences qualité / conformité ne sont pas diffusées (dites-moi si vous le souhaitez).

## Plan d'action
Nouveau tableau sur les pages Objectifs & conformité du groupe et de l'établissement : Action · Objectif · Livrable / preuve · Priorité · Indicateurs · Objectif cible · Responsable · Échéance · Statut (modifiable). Indicateurs et cible proviennent de l'objectif lié (une action sans objectif a ces colonnes vides). Le tableau reprend aussi les actions correctrices d'audit du groupe / de l'établissement.
Nouveaux champs d'action : `strategicGoalCycleId` (objectif lié, contrôlé : même groupe/établissement) et `livrable`.

## Schéma
`StrategicPlan` et `StrategicGoal` : `diffuse`, `parentPlanId` / `parentGoalId` (+ unicité par établissement et parent). `Action` : `strategicGoalCycleId`, `livrable`.
