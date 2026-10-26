# Inventaire des routes API et de leur contrôle d'accès (P0)

177 handlers. Généré à partir du code ; le test `tests/authz-coverage.test.ts` échoue si une route n'a ni garde ni exception justifiée.

## Répartition

- `guardRecord` : 75
- `guardCreate` : 36
- `requireConfigAccess` : 18
- `exception` : 17
- `guardInitiative` : 8
- `guardAuthenticated` : 6
- `canGlobally` : 5
- `?` : 3
- `guardLink` : 2
- `guardGroup` : 2
- `guardScope` : 1
- `guardEstablishment` : 1
- `guardOwner` : 1
- `guardInitiativeCreate` : 1
- `deletion` : 1

## Exceptions justifiées

- `GET /api/admin/authz-inventory` — protégé par la clé d'administration (ADMIN_SEED_KEY), lecture seule
- `GET /api/admin/bootstrap-admin` — protégé par la clé d'administration (ADMIN_SEED_KEY)
- `GET /api/admin/migrate-objectifs` — protégé par la clé d'administration (ADMIN_SEED_KEY)
- `GET /api/admin/migrate-owner-fields` — protégé par la clé d'administration (ADMIN_SEED_KEY)
- `GET /api/admin/migrate-project-templates` — protégé par la clé d'administration (ADMIN_SEED_KEY)
- `GET /api/admin/seed-workflow-stages` — protégé par la clé d'administration (ADMIN_SEED_KEY)
- `GET /api/admin/users/[id]` — assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally)
- `PATCH /api/admin/users/[id]` — assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally)
- `POST /api/auth/accept-invite` — public par conception : jeton d'invitation à usage unique
- `POST /api/auth/login` — public par conception : authentification
- `POST /api/auth/logout` — ne concerne que la session de l'appelant
- `POST /api/auth/register` — protégé par un code d'invitation (REGISTER_INVITE_CODE) ; crée un compte SANS affectation (aucun accès métier en mode enforce)
- `DELETE /api/establishments/[id]` — contrôle des droits de suppression dans handleDelete (lib/deletion.ts)
- `DELETE /api/groups/[id]` — contrôle des droits de suppression dans handleDelete (lib/deletion.ts)
- `GET /api/me` — ne renvoie que les éléments dont l'appelant (son acteur) est responsable
- `POST /api/me/link-actor` — ne modifie que le compte de l'appelant

## Détail

| Route | Méthode | Contrôle | Cible / règle |
|---|---|---|---|
| `/api/actions` | POST | guardCreate | "action", body |
| `/api/actions/[id]` | DELETE | guardRecord | "action", params.id, "supprimer" |
| `/api/actions/[id]` | PATCH | guardRecord | "action", params.id, "modifier", body |
| `/api/actions/[id]/audit` | PUT | guardRecord | "action", params.id, "modifier") : await guardEstablishment(scopeKey,  |
| `/api/actor-affiliations` | POST | guardCreate | "actorAffiliation", body |
| `/api/actor-affiliations/[id]` | DELETE | guardRecord | "actorAffiliation", params.id, "supprimer" |
| `/api/actor-allocations` | POST | guardCreate | "actorAllocation", body |
| `/api/actor-unavailabilities/[id]` | DELETE | guardRecord | "actorUnavailability", params.id, "supprimer" |
| `/api/actors` | POST | guardCreate | "actor", body |
| `/api/actors/[id]` | DELETE | guardRecord | "actor", params.id, "supprimer" |
| `/api/actors/[id]` | PATCH | guardRecord | "actor", params.id, "modifier", body |
| `/api/actors/[id]/unavailabilities` | POST | guardRecord | "actor", params.id, "modifier", body |
| `/api/admin/authz-inventory` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY), lecture seule |
| `/api/admin/bootstrap-admin` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY) |
| `/api/admin/migrate-objectifs` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY) |
| `/api/admin/migrate-diffusion-states` | GET | exception | ADMIN_SEED_KEY, simulation par défaut (apply=1 pour appliquer) |
| `/api/admin/migrate-owner-fields` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY) |
| `/api/admin/migrate-project-templates` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY) |
| `/api/admin/seed-workflow-stages` | GET | Exception justifiée | protégé par la clé d'administration (ADMIN_SEED_KEY) |
| `/api/admin/user-assignments/[id]` | DELETE | canGlobally | gererUtilisateurs (plateforme) |
| `/api/admin/users` | GET | canGlobally | gererUtilisateurs (plateforme) |
| `/api/admin/users` | POST | canGlobally | gererUtilisateurs (plateforme) |
| `/api/admin/users/[id]` | GET | Exception justifiée | assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally) |
| `/api/admin/users/[id]` | PATCH | Exception justifiée | assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally) |
| `/api/admin/users/[id]/assignments` | POST | canGlobally | gererUtilisateurs (plateforme) |
| `/api/admin/users/[id]/invite` | POST | canGlobally | gererUtilisateurs (plateforme) |
| `/api/anomalies` | POST | guardCreate | "anomaly", body |
| `/api/anomalies/[id]` | PATCH | guardRecord | "anomaly", params.id, "modifier", body |
| `/api/audit-findings` | POST | guardCreate | "auditFinding", body |
| `/api/audit-findings/[id]` | PATCH | guardRecord | "auditFinding", params.id, "modifier", body |
| `/api/audit-findings/[id]/corrective-action` | POST | guardRecord | "auditFinding", params.id, "modifier" |
| `/api/auth/accept-invite` | POST | Exception justifiée | public par conception : jeton d'invitation à usage unique |
| `/api/auth/login` | POST | Exception justifiée | public par conception : authentification |
| `/api/auth/logout` | POST | Exception justifiée | ne concerne que la session de l'appelant |
| `/api/auth/register` | POST | Exception justifiée | protégé par un code d'invitation (REGISTER_INVITE_CODE) ; crée un compte SANS affectation (aucun accès métier en mode enforce) |
| `/api/backlog` | POST | guardCreate | "backlogItem", body |
| `/api/baseline-audits/[id]/risks` | POST | guardRecord | "baselineAudit", params.id, "modifier" |
| `/api/baseline-audits/[id]/validate` | POST | guardRecord | "baselineAudit", params.id, "valider" |
| `/api/budget-lines` | POST | guardCreate | "budgetLine", body |
| `/api/budget-lines/[id]` | DELETE | guardRecord | "budgetLine", params.id, "supprimer" |
| `/api/budget-lines/[id]` | PATCH | guardRecord | "budgetLine", params.id, "modifier", body |
| `/api/changes` | POST | guardCreate | "changeRequest", body |
| `/api/changes/[id]` | PATCH | guardRecord | "changeRequest", params.id, "modifier", body |
| `/api/decisions` | POST | guardCreate | "decision", body |
| `/api/decisions/[id]` | DELETE | guardRecord | "decision", params.id, "supprimer" |
| `/api/decisions/[id]` | PATCH | guardRecord | "decision", params.id, "modifier", body |
| `/api/deletion-preview` | GET | deletion.ts | droit « supprimer » (même décision centralisée) |
| `/api/deliverables` | POST | guardCreate | "deliverable", body |
| `/api/deliverables/[id]` | PATCH | guardRecord | "deliverable", params.id, "modifier", body |
| `/api/documents` | GET | guardInitiative | initiativeId, "voir" |
| `/api/documents` | POST | guardCreate | "documentRef", body |
| `/api/documents/[id]` | DELETE | guardRecord | "documentRef", params.id, "supprimer" |
| `/api/documents/[id]` | PATCH | guardRecord | "documentRef", params.id, "modifier", body |
| `/api/documents/upload` | POST | guardCreate | "documentRef", { initiativeId: initiativeIdRaw, ownerType, ownerId: ow |
| `/api/establishment-interfaces` | POST | guardCreate | "establishmentInterface", body |
| `/api/establishment-interfaces/[id]` | DELETE | guardRecord | "establishmentInterface", params.id, "supprimer" |
| `/api/establishments` | GET | guardAuthenticated + filtre de visibilité | résultats limités aux établissements, projets et enregistrements visibles |
| `/api/establishments` | POST | guardScope | (d) => groupScope(d, String(body.groupId)), "gererStructure", `group:$ |
| `/api/establishments/[id]` | DELETE | Exception justifiée | contrôle des droits de suppression dans handleDelete (lib/deletion.ts) |
| `/api/establishments/[id]` | PATCH | guardEstablishment | params.id, "gererStructure" |
| `/api/gaps` | POST | guardCreate | "gap", body |
| `/api/gaps/[id]` | PATCH | guardRecord | "gap", params.id, "modifier", body |
| `/api/goal-indicator-baselines/[id]` | PATCH | guardRecord | "goalIndicatorBaseline", params.id, "valider" |
| `/api/goal-indicator-measures/[id]` | DELETE | guardRecord | "goalIndicatorMeasure", params.id, "supprimer" |
| `/api/goal-indicators/[id]` | DELETE | guardRecord | "goalIndicator", params.id, "supprimer" |
| `/api/goal-indicators/[id]` | PATCH | guardRecord | "goalIndicator", params.id, "modifier", body |
| `/api/goal-indicators/[id]/baseline` | POST | guardRecord | "goalIndicator", params.id, "modifier" |
| `/api/goal-indicators/[id]/baseline-action` | POST | guardRecord | "goalIndicator", params.id, "modifier" |
| `/api/goal-indicators/[id]/measures` | POST | guardRecord | "goalIndicator", params.id, "modifier" |
| `/api/groups` | POST | guardCreate | "group", {} |
| `/api/groups/[id]` | DELETE | Exception justifiée | contrôle des droits de suppression dans handleDelete (lib/deletion.ts) |
| `/api/groups/[id]` | PATCH | guardGroup | params.id, "gererStructure" |
| `/api/groups/[id]/diffusion` | POST | guardGroup | params.id, "diffuser" |
| `/api/incidents` | POST | guardCreate | "incident", body |
| `/api/incidents/[id]` | DELETE | guardRecord | "incident", params.id, "supprimer" |
| `/api/incidents/[id]` | PATCH | guardRecord | "incident", params.id, "modifier", body |
| `/api/initiative-establishments` | POST | guardCreate | "initiativeEstablishment", body |
| `/api/initiative-establishments/[id]` | DELETE | guardRecord | "initiativeEstablishment", params.id, "supprimer" |
| `/api/initiative-establishments/[id]` | PATCH | guardRecord | "initiativeEstablishment", params.id, "modifier", body |
| `/api/initiative-goal-contributions` | POST | guardLink | "initiativeGoalContribution", body, ["strategicGoalCycleId"] |
| `/api/initiative-goal-contributions/[id]` | DELETE | guardRecord | "initiativeGoalContribution", params.id, "supprimer" |
| `/api/initiative-relations` | POST | guardInitiative | String(body.initiativeSourceId), "modifier" |
| `/api/initiative-relations/[id]` | DELETE | guardRecord | "initiativeRelation", params.id, "modifier" |
| `/api/initiative-requirement-coverages` | POST | guardLink | "initiativeRequirementCoverage", body, ["qualityRequirementId"] |
| `/api/initiative-requirement-coverages/[id]` | DELETE | guardRecord | "initiativeRequirementCoverage", params.id, "supprimer" |
| `/api/initiative-requirement-coverages/[id]` | PATCH | guardRecord | "initiativeRequirementCoverage", params.id, "modifier", body |
| `/api/initiatives` | GET | guardAuthenticated + filtre de visibilité | résultats limités aux établissements, projets et enregistrements visibles |
| `/api/initiatives` | POST | guardInitiativeCreate | body |
| `/api/initiatives/[id]` | DELETE | guardInitiative | params.id, "supprimer" |
| `/api/initiatives/[id]` | GET | guardInitiative | params.id, "voir" |
| `/api/initiatives/[id]` | PATCH | guardInitiative | params.id, "modifier" |
| `/api/initiatives/[id]/health-score` | GET | guardInitiative | params.id, "voir" |
| `/api/initiatives/[id]/stages/[key]/expected` | POST | guardInitiative | params.id, "modifier" |
| `/api/initiatives/[id]/stages/[key]/gate` | POST | guardInitiative | params.id, "valider" |
| `/api/installed-products` | POST | guardCreate | "installedProduct", body |
| `/api/installed-products/[id]` | DELETE | guardRecord | "installedProduct", params.id, "supprimer" |
| `/api/interfaces` | POST | guardCreate | "interface", body |
| `/api/interfaces/[id]` | DELETE | guardRecord | "interface", params.id, "supprimer" |
| `/api/interfaces/[id]` | PATCH | guardRecord | "interface", params.id, "modifier", body |
| `/api/kpis` | POST | guardCreate | "kpi", body |
| `/api/kpis/[id]` | DELETE | guardRecord | "kpi", params.id, "supprimer" |
| `/api/kpis/[id]` | PATCH | guardRecord | "kpi", params.id, "modifier", body |
| `/api/me` | GET | Exception justifiée | ne renvoie que les éléments dont l'appelant (son acteur) est responsable |
| `/api/me/link-actor` | POST | Exception justifiée | ne modifie que le compte de l'appelant |
| `/api/meetings` | POST | guardCreate | "meeting", body |
| `/api/meetings/[id]` | DELETE | guardRecord | "meeting", params.id, "supprimer" |
| `/api/meetings/[id]` | GET | guardRecord | "meeting", params.id, "voir" |
| `/api/meetings/[id]` | PATCH | guardRecord | "meeting", params.id, "modifier", body |
| `/api/objective-links/[id]` | DELETE | guardRecord | "strategicGoalLink", params.id, "supprimer" |
| `/api/objectives` | GET | guardOwner | ownerType, ownerId, "voir" |
| `/api/objectives` | POST | guardCreate | "strategicGoalCycle", body |
| `/api/objectives/[id]` | GET | guardRecord | "strategicGoalCycle", params.id, "voir" |
| `/api/objectives/[id]` | PATCH | guardRecord | "strategicGoalCycle", params.id, "modifier", body |
| `/api/objectives/[id]/diffuse` | POST | guardRecord | "strategicGoalCycle", params.id, "diffuser" |
| `/api/objectives/[id]/etat` | POST | guardRecord | "strategicGoalCycle", params.id, "modifier" |
| `/api/objectives/[id]/derogation` | POST | guardRecord | "strategicGoalCycle", params.id, "voir" ou "modifier" ; décision : + guardRecord sur le cycle parent, "valider", + canDecideDerogation |
| `/api/objectives/[id]/changes/[changeId]` | POST | guardRecord | "strategicGoalCycle", params.id, "modifier" |
| `/api/objectives/[id]/indicators` | POST | guardRecord | "strategicGoalCycle", params.id, "modifier" |
| `/api/objectives/[id]/links` | POST | guardRecord | "strategicGoalCycle", params.id, "modifier" |
| `/api/problems` | POST | guardCreate | "problem", body |
| `/api/problems/[id]` | DELETE | guardRecord | "problem", params.id, "supprimer" |
| `/api/problems/[id]` | PATCH | guardRecord | "problem", params.id, "modifier", body |
| `/api/project-templates` | GET | guardAuthenticated |  |
| `/api/project-templates` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/project-templates/[id]` | GET | guardAuthenticated |  |
| `/api/project-templates/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/project-templates/[id]/stages` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/project-templates/options` | GET | guardAuthenticated |  |
| `/api/project-types` | GET | guardAuthenticated |  |
| `/api/project-types` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/project-types/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/quality-requirements` | POST | guardCreate | "qualityRequirement", body |
| `/api/quality-requirements/[id]` | PATCH | guardRecord | "qualityRequirement", params.id, "modifier", body |
| `/api/quality-requirements/[id]/applicability` | GET | guardRecord | "qualityRequirement", params.id, "voir" |
| `/api/quality-requirements/[id]/applicability` | PATCH | guardRecord | "qualityRequirement", params.id, "modifier", body |
| `/api/quality-requirements/[id]/applicability` | PUT | guardRecord | "qualityRequirement", params.id, "modifier", body |
| `/api/raci` | POST | guardCreate | "raciEntry", body |
| `/api/raci/[id]` | DELETE | guardRecord | "raciEntry", params.id, "supprimer" |
| `/api/releases` | POST | guardCreate | "release", body |
| `/api/releases/[id]` | DELETE | guardRecord | "release", params.id, "supprimer" |
| `/api/releases/[id]` | PATCH | guardRecord | "release", params.id, "modifier", body |
| `/api/requirements` | POST | guardCreate | "requirement", body |
| `/api/requirements/[id]` | PATCH | guardRecord | "requirement", params.id, "modifier", body |
| `/api/risks` | POST | guardCreate | "risk", body |
| `/api/risks/[id]` | DELETE | guardRecord | "risk", params.id, "supprimer" |
| `/api/risks/[id]` | PATCH | guardRecord | "risk", params.id, "modifier", body |
| `/api/search` | GET | guardAuthenticated + filtre de visibilité | résultats limités aux établissements, projets et enregistrements visibles |
| `/api/stage-criteria-templates` | GET | guardAuthenticated |  |
| `/api/stage-criteria-templates` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/stage-criteria-templates/[id]` | DELETE | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/stage-criteria/[id]` | PATCH | guardRecord | "stageCriterion", params.id, "modifier", body |
| `/api/stage-definitions` | GET | guardAuthenticated |  |
| `/api/stage-definitions` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/stage-definitions/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/stakeholders` | POST | guardCreate | "stakeholder", body |
| `/api/stakeholders/[id]` | DELETE | guardRecord | "stakeholder", params.id, "supprimer" |
| `/api/stakeholders/[id]` | PATCH | guardRecord | "stakeholder", params.id, "modifier", body |
| `/api/strategic-goal-cycles` | POST | guardCreate | "strategicGoalCycle", body |
| `/api/strategic-goal-cycles/[id]` | PATCH | guardRecord | "strategicGoalCycle", params.id, "modifier", body |
| `/api/strategic-goals` | POST | guardCreate | "strategicGoal", body |
| `/api/strategic-goals/[id]` | PATCH | guardRecord | "strategicGoal", params.id, "modifier", body |
| `/api/strategic-plans` | POST | guardCreate | "strategicPlan", body |
| `/api/strategic-plans/[id]` | PATCH | guardRecord | "strategicPlan", params.id, "modifier", body |
| `/api/template-stage-criteria/[id]` | DELETE | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stage-criteria/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stage-items/[id]` | DELETE | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stage-items/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stages/[id]` | DELETE | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stages/[id]` | PATCH | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stages/[id]` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stages/[id]/criteria` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/template-stages/[id]/items` | POST | requireConfigAccess | droit « gererStructure » plateforme |
| `/api/training-sessions` | POST | guardCreate | "trainingSession", body |
| `/api/trainings` | POST | guardCreate | "trainingRecord", body |
| `/api/trainings/[id]` | PATCH | guardRecord | "trainingRecord", params.id, "modifier", body |
| `/api/vigilance-points` | POST | guardCreate | "vigilancePoint", body |
| `/api/vigilance-points/[id]` | PATCH | guardRecord | "vigilancePoint", params.id, "modifier", body |
