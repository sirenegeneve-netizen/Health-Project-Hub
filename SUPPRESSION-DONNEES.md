# Suppression des données métier (HPH)

## Règle centrale
Supprimer un groupe, un établissement ou une initiative ne supprime jamais un `User`, une `Session`, un `InviteToken` ni l'authentification. Les référentiels (`WorkflowStage`, `StageCriterionTemplate`, `Methodology*`) ne sont jamais touchés.

## Aucune modification de schema.prisma
Les cascades déjà définies sont utilisées. Ce que Prisma ne couvre pas est fait explicitement, dans une transaction :
- objets `ownerType/ownerId` (sans clé étrangère) : Actions, Risques, Décisions, Documents, et pour groupe/établissement : constats d'audit, exigences qualité, plans et objectifs stratégiques ;
- `InitiativeEstablishment → Establishment` (Restrict par défaut) : lien retiré avant suppression de l'établissement ;
- `Actor.initiativeId` est en Cascade : supprimer une initiative aurait supprimé ses acteurs, même réutilisés ailleurs. Les acteurs liés à un compte, affiliés à un groupe/établissement ou référencés hors de l'initiative sont détachés (`initiativeId = null`) et conservés ; seuls les acteurs propres à l'initiative sont supprimés ;
- `UserAssignment` : retirée seulement si l'utilisateur en garde une autre (sinon il retomberait en mode transitoire = accès complet) ;
- fichiers Vercel Blob des documents : supprimés après commit (au mieux).

## Autorisation (côté serveur, `src/lib/deletion.ts`)
Session obligatoire (401), puis `can()` sur le périmètre réel de l'objet (403) :
- initiative, risque, action, décision, document, réunion, KPI : permission `supprimer` ;
- groupe, établissement : permission `gererStructure` (administrateur).
Un journal d'audit est écrit dans la même transaction.

## Routes
- `DELETE /api/groups|establishments|initiatives|meetings/[id]` (nouvelles)
- `DELETE /api/risks|actions|decisions|documents|kpis/[id]` (existantes, maintenant avec contrôle de droits et transaction)
- `GET /api/deletion-preview?kind=&id=` (compteurs pour la confirmation)
Objet déjà supprimé : réponse 200 `{ alreadyGone: true }`.

## Tests
`TEST_DATABASE_URL=postgresql://... npm test` (base de test dédiée, schéma poussé avec `prisma db push`). Le test refuse de tourner si l'URL est celle de DATABASE_URL.
