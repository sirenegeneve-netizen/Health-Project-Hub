# Objectifs — listes de référence, valeur initiale inconnue, formulaire élargi

Cumulatif avec le Lot 2 des objectifs. Entièrement additif : aucune colonne ni donnée existante modifiée ou supprimée.

## Audit (constats)
- `GoalIndicator.valeurInitiale` était déjà nullable et `indicatorProgress` renvoyait déjà `null` sans valeur initiale : le socle « inconnu ≠ zéro » existait côté calcul. Manquaient : état explicite, traçabilité (date/source/justificatif), action d'état des lieux.
- « Périmètre / population » = un seul texte libre (`StrategicGoalCycle.perimetre`). Conservé comme **précision facultative** (aucune perte).
- Aucun champ « thème » n'existait. Le seul « niveau » (`InitiativeGoalContribution.niveau`, `QualityRequirementCoverage.niveau`) désigne principale/secondaire ou totale/partielle : **sans rapport, non touché, aucune migration de « niveau » nécessaire**.
- Largeur : le contenu était limité deux fois — `main max-w-6xl` (layout) puis `max-w-3xl` (formulaire) / `max-w-4xl` (fiche).

## Schéma (db push, additif)
- `StrategicGoalCycle` : `perimetreOrg String[]`, `populations String[]` (codes), relation `scopeEstablishments`.
- `GoalCycleScopeEstablishment` (nouveau) : établissements précisés, FK vers établissements existants (cascade).
- `GoalIndicator` : `theme String?`, `baselineActionId String?` (identifiant simple, sans relation).
- `GoalIndicatorBaseline` (nouveau) : historique de la valeur initiale (valeur, date, source, justificatif, statut propose|valide|remplace, auteur, validation).
- `Establishment` : relation inverse uniquement.
Les valeurs sont des **codes** (`src/lib/referentiels.ts`), jamais des libellés.

## Règles métier
- Périmètre organisationnel (22) et population (19) : sélection multiple ; « Aucune population directe » exclusive. Établissements précisés : sélection parmi les établissements du groupe (rejet 400 sinon). Rien d'obligatoire.
- Thème (8) : sélection unique, facultatif, validé côté serveur. Fait partie de la **définition héritée du groupe** (verrouillé sur la copie établissement, propagé et copié à la diffusion). Indicateurs existants : thème vide (« Non défini »).
- Valeur initiale : `null` = inconnue, `0` = vraie valeur. État dérivé (jamais stocké) : à établir / à valider / établie. Aucune progression tant que non établie.
- Action « État des lieux initial » : mécanisme `Action` existant (origine `etat_des_lieux`), **une seule par objectif** pour tous les indicateurs sans valeur initiale, texte prérempli et modifiable, refusable (décocher). Ajout d'un indicateur ultérieur : réutilise l'action ouverte, sans doublon. Aucune action si les valeurs sont renseignées (zéro compris).
- Établir la valeur : valeur + date + source + justificatif, « valider » ou « proposer » ; valeur validée = nouvelle valeur initiale, les précédentes passent à « remplacée » (historique conservé). Saisie directe via « Modifier » : trace automatique.
- Objectif de groupe diffusé : chaque établissement établit sa propre valeur initiale ; l'action créée côté groupe le mentionne, aucune action n'est générée en masse.

## Interface
- Formulaire de création/fiche : pleine largeur (jusqu'à 1600 px) via `data-wide-page` (le layout élargit `main` uniquement pour ces pages), champs courts en 2–4 colonnes, descriptions en pleine largeur, 1 colonne sur mobile. Multi-sélections : pastilles retirables + liste à cocher en colonnes, filtre au-delà de 8 choix.
- Même composant `ScopeFields` pour la création et la modification d'un objectif.

## Migration de données
Aucune obligatoire. `db push` crée colonnes/tables. Les anciens textes de périmètre restent visibles (« Précision »). Pas de reclassement automatique.

## Tests
`npx tsx --test tests/referentiels-baseline.test.ts` (nomenclatures, exclusivité, thème, inconnu ≠ zéro, progression, un audit par objectif, texte prérempli).

## Points à valider
1. « Établissements concernés » (périmètre) est distinct de la diffusion : à confirmer.
2. Thème facultatif (non obligatoire) — le rendre obligatoire à la création ?
3. Le statut de l'action d'audit ne valide pas automatiquement la valeur initiale (validation manuelle voulue).
4. Justificatif : référence texte ; fichier via Documents.
