# P1 — Déclinaison par établissement (octobre 2026)

Statut : **livrée au code, non déployée, non validée.** Validation par l'utilisatrice en préproduction (voir « Tests à faire »).
Ce qui a été vérifié ici : tests de logique pure (95 réussis, 1 échec attendu : `deletion.test.ts`, `@prisma/client` absent du bac à sable) et absence d'erreur de syntaxe (`error TS1`). **Non vérifié : build, `prisma generate`, toute exécution contre une base.**

## Règles métier

- **États** : `non_pris_en_charge`, `pris_en_charge`, `en_cours`, `termine`, `non_applicable`, `hors_perimetre`. Déclarés par l'établissement (prendre en charge, démarrer, terminer, rouvrir, annuler la prise en charge), jamais déduits des actions. Aucune action pendant une demande de dérogation, hors périmètre ou non applicable.
- **Dérogation** : l'établissement demande (motif obligatoire, impossible une fois la mise en œuvre commencée) et peut retirer sa demande. Le directeur ou l'administrateur du groupe valide (→ `non_applicable`), refuse (note obligatoire) ou révoque (→ `non_pris_en_charge`). Après un refus, l'établissement peut redemander.
- **Diffusion sélective** : mode « tous » (inclut les établissements rattachés plus tard) ou « selection » (table `GoalDiffusionTarget`). Simulation (`dryRun`) puis application. Un établissement retiré garde sa déclinaison, marquée `hors_perimetre` (état précédent mémorisé) ; s'il revient, l'état est restauré. Jamais de doublon, opération idempotente. Anciennes diffusions (portée « aucune ») traitées comme « tous ».
- **Changements du groupe** : champs suivis = intitulé, description (déjà propagés : signalement informatif), résultat attendu, axe, échéance, précision du périmètre, périmètre organisationnel, population. « Accepter » recopie seulement les champs non propagés ; « Ignorer » conserve le local. Décision historisée, une par changement et par déclinaison. Jamais touchés : cible locale, indicateurs locaux, responsable, statut.
- **États de départ** des déclinaisons existantes : « en cours » si action, mesure, valeur initiale ou responsable, sinon « non pris en charge ». Simulation par défaut ; ne touche jamais un état déjà renseigné.
- **Droits** : l'établissement modifie sa déclinaison (`guardRecord`, « modifier ») ; le groupe consulte. Décider d'une dérogation : « valider » sur le cycle parent **et** rôle directeur / administrateur du groupe. Diffuser : permission « diffuser ».

## Fichiers

Nouveaux : `src/lib/declinaison.ts` (règles pures), `src/lib/declinaisonDb.ts` (accès base), `src/lib/declinaisonAccess.ts` (aide d'affichage des boutons, pas une protection), `src/components/objectif/DiffusionSelector.tsx`, `DeclinationPanel.tsx`, `DeclinationsTable.tsx`, routes `objectives/[id]/etat`, `objectives/[id]/derogation`, `objectives/[id]/changes/[changeId]`, `admin/migrate-diffusion-states`, tests `declinaison.test.ts`, `declinaison-droits.test.ts`.
Modifiés : `prisma/schema.prisma` (ajouts seulement), `src/lib/diffusionDb.ts` (synchronisation selon la sélection), `src/lib/objectifsDb.ts` (`loadObjectiveDetail`), `src/app/api/objectives/[id]/route.ts` (PATCH : enregistrement des changements), `src/app/api/objectives/[id]/diffuse/route.ts` (mode, sélection, simulation), `src/components/objectif/ObjectiveSheet.tsx`, `docs/AUTHZ-INVENTAIRE-ROUTES.md`.
Supprimé : `DiffuseObjectiveButton.tsx` (remplacé par `DiffusionSelector`).

## Migration de schéma

Ajouts seulement (colonnes nullables sur `StrategicGoalCycle`, trois nouvelles tables, relation inverse sur `Establishment`). Aucune suppression, aucun renommage. `prisma db push` sans `--accept-data-loss`. **Sauvegarde (branche Neon) vérifiée avant tout déploiement.** Retour arrière : restaurer la branche Neon ; le code précédent ignore les nouvelles colonnes.
Après déploiement du schéma : `GET /api/admin/migrate-diffusion-states?key=ADMIN_SEED_KEY` (simulation), puis `&apply=1`.

## Tests à faire en préproduction (après sauvegarde)

1. Simulation des états de départ, comparer avec la réalité, puis application.
2. Diffusion sélective : simuler, appliquer à 2 établissements sur 3 ; vérifier qu'aucun cycle n'est créé pour le 3e.
3. Retrait d'un établissement (→ « Hors périmètre », données conservées, lecture seule), puis retour (état restauré).
4. Modifier un objectif du groupe diffusé → signalement chez les déclinaisons ; « Accepter » (champs hérités seulement) et « Ignorer » ; vérifier cible, indicateurs, responsable, statut inchangés.
5. Dérogation : demande (sans motif refusée), refus (sans note refusé), validation, révocation, retrait ; tentative de décision par un chef de projet de groupe (doit être refusée).
6. Comptes croisés : un établissement ne modifie pas la déclinaison d'un autre ; le groupe ne modifie pas une déclinaison.
7. `scripts/authz-smoke.mjs` si possible.

## Limites connues

- Rien n'a été exécuté contre une base ni compilé ici ; erreurs de types possibles au premier build (Next n'en montre qu'une à la fois : transmettre la capture suivante).
- `applySelection` remplace la liste `GoalDiffusionTarget` (suppression puis recréation de lignes de configuration, pas de données métier).
- La modification de la sélection d'« établissements précisés » n'est pas un champ suivi (pas de signalement).
- Un échec d'enregistrement d'un signalement est journalisé sans faire échouer la modification de l'objectif.
- Les boutons masqués selon les droits sont une aide d'affichage ; le contrôle réel est dans les routes.
- Points ouverts du dossier de reprise inchangés (section 9) : tests HTTP des droits jamais lancés, migrations versionnées non exécutées, projets partagés (P3), règles d'avancement (P2).
