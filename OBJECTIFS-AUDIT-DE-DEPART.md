# Audit de départ — rendre l'action « Audit de départ » opérationnelle

## Audit de l'existant
- L'action est reconnue par `Action.origine = "etat_des_lieux"` (créée par `ensureBaselineAction` / création d'objectif) ; les indicateurs concernés pointent vers elle via `GoalIndicator.baselineActionId`.
- Le module Actions n'avait **aucune page de détail** : liste (statut modifiable en ligne) et kanban. D'où l'impression d'être limité au statut.
- Réutilisé : `Action` (actions correctives, `auditFindingId`, `strategicGoalCycleId`, `indicatorId`), `AuditFinding` (constats : écart / observation / point fort), `StrategicGoalLink` (lien constat/risque ↔ objectif), `Risk` (registre), `GoalIndicatorBaseline` (historique de la valeur initiale), `logAudit` (historique).
- Aucun module d'audit parallèle : seul l'enregistrement de l'audit lui-même (brouillon → validé) est nouveau.

## Modèle (additif, `db push`)
- `BaselineAudit` : un par action et par périmètre (`scopeKey` = « global » ou id d'établissement), statut brouillon | valide, date, auditeur, `contenu` (JSON : méthode, constats, risques, conclusion).
- `BaselineAuditMeasure` : une ligne par indicateur — `mesuree` | `indeterminee` | `non_realisee` ; valeur nullable (jamais 0 par défaut), date de référence, méthode, source, commentaire.
- `AuditFinding.baselineAuditId` (nouveau champ simple) : remonter du constat à l'audit.
- `Action` : relation inverse uniquement.

## Règles métier
- Bouton « Réaliser l'audit » sur l'action (liste, kanban, plan d'action de l'objectif, bandeau de l'indicateur) → `/actions/[id]/audit`, sans nouvelle action. Contexte (objectif, finalité, indicateur, unité, cible, périmètre, établissements, responsable, échéance) affiché en lecture seule.
- Enregistrer le brouillon fait passer l'action « à faire » → « en cours », **jamais « terminé »**. Ouvrir le formulaire ne change rien.
- Validation : date, auditeur, synthèse, besoin d'actions requis ; pour une mesure « mesurée » : valeur numérique (0 valide, vide non), date de référence, source, méthode ou commentaire ; pour « indéterminée » : commentaire expliquant pourquoi ; au moins un indicateur évalué. Les données sont enregistrées avant la validation : aucune perte en cas d'erreur.
- À la validation : seules les mesures « mesurées » mettent à jour la valeur initiale (historique `GoalIndicatorBaseline`, source, date, justificatif = référence à l'audit, auteur/validateur) ; les constats deviennent de vrais `AuditFinding` liés à l'objectif ; l'audit est verrouillé. Évaluation sans valeur ou audit non réalisé : la valeur reste **inconnue**.
- Clôture de l'action : seulement proposée (bouton explicite) quand tous les périmètres attendus ont un audit validé.
- Actions correctives : à la demande, depuis un constat (écart / observation), via le module Actions, **une seule par constat** (idempotent), rattachée à l'objectif, à l'indicateur (si audit à indicateur unique) et au constat. Risques : « Ajouter au registre des risques » (idempotent), lié à l'objectif.
- Multi-établissements : un audit par établissement ; la valeur validée va sur la **copie de l'établissement** (périmètre global : l'indicateur du groupe). Consolidation : non évalué / brouillon / évalué sans résultat exploitable / mesure validée, avec manques signalés ; **aucune valeur agrégée automatiquement**.

## Tests
`npx tsx --test tests/baseline-audit.test.ts` (11 tests : reconnaissance de l'action, vide ≠ zéro, validation, trois situations, consolidation, clôture suggérée, action corrective).

## Limites
- Pas de rouverture d'un audit validé (corriger via « Valeur initiale » de l'indicateur) ; pas d'échelle de maîtrise (aucune échelle adaptée n'existe dans HPH) ; pièces jointes : référence texte ; indicateurs numériques uniquement (type actuel).
- Écrans et routes non exécutés en conditions réelles (pas de build dans le bac à sable).
