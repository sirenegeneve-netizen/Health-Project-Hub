# Refonte Objectifs & conformité — Lot 1 (fondations, sans interface)

Strictement additif et idempotent : aucune table ni colonne supprimée ou renommée, aucune donnée modifiée hors recopie décrite ci-dessous. L'interface actuelle continue de fonctionner à l'identique ; les écrans de ce nouveau modèle arrivent aux Lots 2 à 4.

## Schéma ajouté
- `StrategicGoalCycle` (= l'objectif) : priorité, pilote, axe, résultat attendu, périmètre, échéance, `parentCycleId` (lien explicite groupe → établissement), `diffusion` (aucune | tous | selection), `updatedAt`.
- `GoalIndicator` (définition : nom, description, unité, sens ≥/≤, valeur initiale, valeur cible, fréquence, échéance, responsable, statut, principal, seuil d'alerte, `parentIndicatorId`, `kpiId`) — `GoalIndicatorMeasure` (valeur + date : la valeur actuelle est toujours la dernière mesure).
- `StrategicGoalLink` : un objectif relié à un risque, une décision, un constat ou une exigence **existants** (vraies clés étrangères, aucun doublon).
- `RequirementApplicability` + `QualityRequirement.portee` : exigence de référence unique au niveau groupe ; applicable à tous (sauf exclusions) ou à une sélection d'établissements ; statut de conformité et évaluation locaux.
- `Action.indicatorId`, `Action.qualityRequirementId` (liens facultatifs).

## Règles métier implémentées (et testées)
- **Progression** (jamais inventée) : indicateurs d'abord ; objectif avec indicateur mais sans mesure → « — » ; sans indicateur mais avec actions → actions terminées / non abandonnées ; sinon « — ». Objectif de groupe diffusé : moyenne des établissements mesurés.
- **Indicateur hérité** : l'établissement ne peut pas modifier la définition (refus 403) ; il saisit valeur initiale, mesures, valeur actuelle et, si besoin, une cible locale (vide = cible du groupe). Un indicateur du groupe ajouté ou modifié est copié / répercuté dans les déclinaisons.
- **Suppression** : un indicateur avec mesures ou copies ne se supprime pas (statut « abandonné »).

## API
`GET/POST /api/objectives` · `GET/PATCH /api/objectives/[id]` · `POST /api/objectives/[id]/indicators` · `PATCH/DELETE /api/goal-indicators/[id]` · `POST /api/goal-indicators/[id]/measures` · `DELETE /api/goal-indicator-measures/[id]` · `POST /api/objectives/[id]/links` · `DELETE /api/objective-links/[id]` · `GET/PUT/PATCH /api/quality-requirements/[id]/applicability`. Création d'objectif en une transaction (indicateurs et actions facultatifs). Tout est journalisé (entité « Objectif », « Exigence »). `PATCH /api/actions/[id]` accepte désormais `strategicGoalCycleId`, `indicatorId`, `qualityRequirementId` (pour rattacher une action existante).

## Migration des données existantes
`/api/admin/migrate-objectifs?key=ADMIN_SEED_KEY&dryRun=1` (simulation), puis sans `dryRun`. Elle : relie chaque déclinaison d'établissement existante à son cycle de groupe (jamais deviné : cas ambigus listés), marque « tous » les cycles déjà diffusés, recopie l'ancienne « cible » texte dans « résultat attendu » si vide (l'ancien texte est conservé). Elle renvoie les comptages avant / après (plans, objectifs, cycles, contributions, actions, exigences, constats) qui doivent rester identiques.
**Écart avec l'audit** : les anciens textes « indicateurs » ne sont PAS convertis en indicateurs. Un indicateur vide ferait afficher « — » à l'objectif et masquerait la progression par les actions. Ils restent lisibles et seront convertibles à la main (Lot 2).

## Mise en service
1. `npm install && npx prisma validate && npx tsc --noEmit && npm test`
2. Déployer (`prisma db push` ajoute colonnes et tables ; rien n'est supprimé — sauvegarde conseillée si la base est la production).
3. Migration : dryRun, puis exécution.
