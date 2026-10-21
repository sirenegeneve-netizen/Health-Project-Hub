# Déploiement sécurisé — sauvegarde, schéma, retour arrière, activation des droits

## 1. Ce qui change dans le déploiement
- Le script de build n'utilise plus `--accept-data-loss` : `prisma generate && prisma db push && next build`. Prisma **refuse** un changement de schéma destructif en environnement non interactif (le build échoue avant toute perte). Les ajouts de colonnes/tables restent possibles.
- Aucun changement de schéma dans la P0 : aucune migration à exécuter pour la livrer.

## 2. Avant TOUT changement de schéma (obligatoire)
1. Sauvegarde vérifiée : branche/point de restauration (Neon : « Branches » ou restauration à un instant donné) **ou** `pg_dump -Fc "$DATABASE_URL" > hph-AAAAMMJJ.dump`.
2. Vérifier la sauvegarde : `pg_restore --list hph-AAAAMMJJ.dump | head` puis restauration d'essai dans une base temporaire (ou une branche) et comptage des lignes des tables principales (Initiative, Action, Risk, StrategicGoalCycle, User).
3. Déployer d'abord en **préproduction** (copie de la production), exécuter les tests, puis seulement en production, après validation explicite.

## 3. Migrations versionnées (à mettre en place avec la CLI Prisma, en préproduction d'abord)
Le dépôt n'a pas de dossier `prisma/migrations` : la base a été construite par `db push`. Pour passer aux migrations versionnées sans toucher aux données :
```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
# Sur la base EXISTANTE, déclarer cette migration comme déjà appliquée (aucune exécution de SQL) :
npx prisma migrate resolve --applied 0_init
# Vérifier qu'il n'y a plus de dérive :
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```
Ensuite, chaque évolution : `npx prisma migrate dev --name ...` (préproduction), relecture du SQL généré (refuser tout `DROP`/`ALTER ... DROP`), puis `npx prisma migrate deploy` en production. Le script de build passera alors à `prisma generate && prisma migrate deploy && next build`. Ces commandes n'ont **pas** pu être exécutées dans l'environnement de travail (pas d'accès à la base) : à faire chez vous.

## 4. Retour arrière
- Code : Vercel → Deployments → redéployer la version précédente (« Instant Rollback »).
- Droits : repasser `AUTHZ_MODE` à `audit` (variable d'environnement Vercel, puis redéploiement) rétablit l'ancien comportement non bloquant sans perte de données.
- Schéma : les migrations sont additives ; en cas de problème, le code précédent reste compatible (colonnes ajoutées ignorées). Une restauration complète n'est qu'un dernier recours (sauvegarde du §2).

## 5. Activer le blocage des droits (AUTHZ_MODE=enforce)
1. Consulter l'inventaire : `GET /api/admin/authz-inventory?key=<ADMIN_SEED_KEY>` (lecture seule). Il liste comptes, rôles, affectations, incohérences, et les comptes qui **perdraient tout accès**, avec une piste de régularisation (établissement de l'acteur lié).
2. Régulariser dans Admin > Utilisateurs (affectations), suspendre les comptes non légitimes. Le champ `readyForEnforce` doit être à `true` ; il exige au moins un administrateur plateforme.
3. Rester en mode `audit` plusieurs jours : chaque refus qui *aurait* eu lieu est journalisé (logs Vercel, recherche : `audit-would-deny`). Corriger les affectations jusqu'à ce que les refus restants soient légitimes.
4. Passer `AUTHZ_MODE=enforce` en **préproduction**, lancer `node scripts/authz-smoke.mjs scripts/authz-smoke.config.json` (accès croisés entre établissements, modifications d'URL et de requêtes, utilisateur sans affectation).
5. Puis en production. Accès de secours si un administrateur est bloqué : `GET /api/admin/bootstrap-admin?key=<ADMIN_SEED_KEY>` (existant).
