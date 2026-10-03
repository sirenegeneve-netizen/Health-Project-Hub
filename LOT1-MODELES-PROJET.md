# Lot 1 — Moteur de modèles de projet

Tout est additif : aucun champ ou table existant n'est supprimé ni renommé. Une initiative sans `templateId` fonctionne exactement comme avant.

## Mise en service (dans cet ordre)
1. Vérifier en local : `npx prisma validate && npx tsc --noEmit && npm test` (le test `tests/templateEngine.test.ts` n'a pas besoin de base).
2. Déployer (le build exécute `prisma db push` : nouvelles tables + colonnes avec valeurs par défaut).
3. **Simulation** : `/api/admin/migrate-project-templates?key=ADMIN_SEED_KEY&step=migrate&dryRun=1` — n'écrit rien (nécessite que les modèles existent : lancer d'abord l'étape 4 sans dryRun si la table est vide, ou `&step=seed`).
4. **Exécution** : `/api/admin/migrate-project-templates?key=ADMIN_SEED_KEY` — seed (36 types, bibliothèque d'étapes, modèle général, un « Modèle standard V1 » par type) puis rattachement des initiatives existantes (copie de leurs étapes actuelles, critères reliés, phase inchangée). Idempotent. Équivalent CLI : `npm run db:seed-project-templates`.
5. Paramètres → Configuration des projets.

## Ce qui change pour l'utilisateur
- Création d'initiative : type lu en base + sélecteur de modèle (automatique si un seul modèle actif). Le parcours et les critères sont copiés à la création (transaction).
- Page d'étape `/etape/[key]` : objectif, critères de passage cliquables, progression, alerte consultative.
- Paramètres : types (ajout, renommage, activation, duplication, archivage — jamais de suppression), modèles (création, duplication, versions, activation, archivage), éditeur de parcours en timeline, bibliothèque d'étapes.
- Un modèle utilisé par des initiatives n'est pas modifiable : « Nouvelle version » (V2), puis activation.

## Hors Lot 1 (prévu au Lot 2)
Livrables, rôles, risques types, décisions, indicateurs, Gates (consultatif/bloquant — `gateMode` et `evaluateStageExit` sont déjà posés), modes automatique/hybride branchés sur `readiness.ts`, règles d'activation par profil de projet. Tables `TemplateStageItem` et champs `config`, `profileFlags` créés mais pas encore exposés.
