# P0 — Sécurisation des autorisations serveur : résultats

**Statut : livrée pour validation en préproduction. Non déclarée validée** : les tests exécutables ici portent sur la logique de décision et de rattachement (sans base de données) et sur la couverture du code. Les tests HTTP réels (accès croisés par URL et requêtes) et les tests de non-régression sur base représentative restent à exécuter en préproduction (`scripts/authz-smoke.mjs`).

## 1. Ce qui a été mis en place
- **Couche centralisée** : `src/lib/authzCore.ts` (décision pure : rôle × portée × ressource), `src/lib/accessResolve.ts` (rattachement de chaque ressource à son groupe / établissement / projet **depuis la base**, jamais depuis le navigateur), `src/lib/access.ts` (gardes de routes, filtres de lecture), `src/lib/pageAccess.ts` (gardes de pages).
- **Moindre privilège** : un rôle de groupe **consulte** les établissements de son groupe sans pouvoir modifier leurs données locales ; permission **« diffuser »** distincte (directeur et administrateur de groupe) ; données de groupe lisibles par un établissement seulement s'il en porte une déclinaison, jamais modifiables.
- **Plus d'accès implicite** : sans affectation, aucun accès en mode `enforce` (le « mode transitoire » de `can()` disparaît). Un compte **suspendu** perd l'accès immédiatement (auparavant, sa session restait valide).
- **Références du corps de requête** : à la création/modification, *toutes* les références (projet, propriétaire, objectif, indicateur, établissement…) sont contrôlées ; un établissement cité à côté d'une cible n'est qu'un lien (lecture), cité seul c'est la cible d'écriture.
- **Administrateurs** : rôle plateforme = accès complet, mais chaque écriture est **tracée** (journal, type « securite »). Les administrateurs de groupe administrent leur groupe sans modifier les données locales. Gestion des comptes : plateforme uniquement (inchangé).
- **Toutes les routes de données** passent par une garde (voir `docs/AUTHZ-INVENTAIRE-ROUTES.md` : 173 handlers). Corrigées aussi : valeur initiale, audit de départ, actions correctives, risques d'audit.
- **Pages** : 53 pages dynamiques (`groups/[id]`, `establishments/[id]`, `initiatives/[id]`) gardées ; modules transverses (tableau de bord, projets, actions, risques, calendrier, capacité, ressources, rapports, réunions, feuille de route, groupes, établissements) filtrés par la **visibilité réelle** (le cookie de périmètre n'est plus qu'un filtre d'affichage, limité aux établissements autorisés) ; journal limité à ses propres opérations hors rôle plateforme ; page d'audit de départ limitée aux établissements autorisés.
- **Mode de déploiement** `AUTHZ_MODE` : `audit` (défaut, ne bloque pas, journalise les refus qui auraient eu lieu) puis `enforce`. Le passage en `enforce` est conditionné à l'inventaire des comptes (`/api/admin/authz-inventory`).
- **Déploiement** : `--accept-data-loss` retiré ; procédure sauvegarde / migrations versionnées / retour arrière dans `docs/DEPLOIEMENT-SECURISE.md`.

## 2. Fichiers
Nouveaux : `src/lib/{authzCore,accessResolve,access,pageAccess,authzInventory}.ts`, `src/app/api/admin/authz-inventory/route.ts`, `tests/authz-{core,resolve,coverage,inventory}.test.ts`, `scripts/authz-smoke.mjs` (+ exemple de configuration), `docs/AUTHZ-INVENTAIRE-ROUTES.md`, `docs/DEPLOIEMENT-SECURISE.md`.
Modifiés : `src/lib/{roles,authz,auth,scope,deletion,baselineAuditDb}.ts`, `package.json`, `.env.example`, toutes les routes de `src/app/api/**` (garde ajoutée ou exception justifiée), 53 pages dynamiques et 12 pages transverses de `src/app/(app)/**`.

## 3. Tests
| Test | Ce qu'il démontre | Résultat ici |
|---|---|---|
| `authz-core` (11) | matrice rôle × portée : monoétablissement, multiétablissements, directeur de groupe en lecture seule, diffusion, administrateurs, projets locaux/partagés/transversaux, sans affectation | passent |
| `authz-resolve` (8) | accès croisés **par identifiant** sur une base en mémoire : action, risque, anomalie, objectif, indicateur, mesure, projet d'un autre établissement refusés ; création falsifiée (propriétaire autorisé + objectif d'un autre établissement) refusée ; mode audit non bloquant mais journalisé | passent |
| `authz-coverage` (4) | **aucune route sans garde ni exception justifiée**, garde avant toute écriture en base | passent |
| `authz-inventory` (4) | repérage des comptes qui perdraient l'accès, incohérences, prérequis à `enforce` | passent |
| Non-régression (suites existantes : objectifs, diffusion, référentiels, audit de départ, calculs) | logique métier inchangée | passent |
| `deletion.test.ts` | — | **échoue avant et après** mes changements : `@prisma/client` absent de l'environnement de travail |
| Accès croisés HTTP réels, modification directe d'URL/requêtes, aucune fuite entre établissements sur base réelle | — | **non exécutables ici** : `scripts/authz-smoke.mjs` à lancer en préproduction (`AUTHZ_MODE=enforce`) |

## 4. Correction de mon audit
J'avais écrit que `deletion-preview` n'avait aucun contrôle de session propre : **inexact**. La route délègue à `handlePreview`, qui vérifie la session et le droit `supprimer`. Ce que le test de couverture a confirmé : les routes de suppression étaient déjà contrôlées ; le vrai défaut était le mode transitoire de `can()` (accès complet sans affectation) et, pour les éléments simples, la décision de groupe trop large (maintenant alignée sur la décision centralisée).

## 5. Arbitrages restant à valider
1. **Défaut `audit`** : tant que `AUTHZ_MODE` n'est pas `enforce`, le trou d'accès reste ouvert (c'est la transition demandée : inventaire puis blocage). À basculer dès la régularisation des comptes.
2. Un utilisateur d'établissement rattaché à un **projet partagé** garde le droit de le modifier tant que les contributions locales (P3) n'existent pas.
3. Modifier la fiche d'un établissement ou d'un groupe exige « gererStructure » (administrateur) : un référent d'établissement ne peut plus la renommer.
4. Réponse **404** (au lieu de 403) sur les pages non autorisées, pour ne pas révéler l'existence ; les routes API répondent 403 / 404.
5. Les données **sans propriétaire ni projet** (anciennes lignes) ne sont visibles que du rôle plateforme : à contrôler dans les logs `audit-would-deny`.

## 6. Limites restantes et actions en préproduction
- Le middleware ne vérifie que la **présence** du cookie : la sécurité repose sur les gardes des routes et des pages (couvertes par le test de couverture, pas par un test d'exécution).
- Les fichiers envoyés (Vercel Blob) sont stockés avec un lien **public** (non devinable) : un contrôle d'accès sur le téléchargement demanderait un changement de stockage (hors P0).
- Capacité : la liste des noms d'acteurs actifs n'est pas filtrée (noms seulement).
- Les pages transverses reposent sur les filtres de `scope.ts` ; chaque module n'a pas été relu requête par requête : à vérifier avec le smoke test et les logs.
- Une requête de visibilité supplémentaire est exécutée par page transverse (impact de performance à mesurer).
- À faire en préproduction : inventaire des comptes → régularisation → période `audit` → `enforce` → `scripts/authz-smoke.mjs` → non-régression fonctionnelle manuelle (création/modification dans chaque module avec un compte de chaque rôle).
