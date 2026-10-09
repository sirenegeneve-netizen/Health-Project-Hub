# Refonte Objectifs & conformité — Lot 2 (création d'objectif + fiche de pilotage)

Additif au Lot 1 (à déployer avec lui s'il ne l'est pas déjà). Aucune donnée existante modifiée, aucune suppression. L'ancienne page reste en place (elle est refondue au Lot 3) ; elle reçoit seulement le bouton « + Nouvel objectif stratégique » et un lien vers la fiche sur chaque objectif.

## Nouveaux écrans (groupe et établissement)
- `/groups/[id]/objectifs/nouveau` et `/establishments/[id]/objectifs/nouveau` : formulaire en sections — A Identification (intitulé*, description, plan*, axe, priorité, pilote, statut) · B Résultat attendu (résultat, périmètre, échéance, indicateur principal avec unité, sens, valeur initiale, actuelle, cible — champs distincts) · C Autres indicateurs · D Premières actions (facultatives, avec livrable et indicateur associé) · case « Diffuser aux établissements » (groupe). Création en une transaction ; si aucun plan n'existe, le plan se crée d'abord depuis la même page.
- `/groups/[id]/objectifs/[cycleId]` et `/establishments/[id]/objectifs/[cycleId]` : fiche de pilotage — en-tête (plan, statut, priorité, pilote, progression calculée et sa base, cible), description, résultat attendu, cibles & indicateurs (initiale → actuelle → cible, saisie de mesure, historique, modification), actions (ajout à tout moment, origine audit / risque / incident / COPIL / réglementaire / complémentaire, livrable, indicateur associé, statut), initiatives contributrices, établissements concernés, exigences, risques, constats, décisions, documents / preuves, historique.

## Règles appliquées
- Progression : jamais inventée (« — » sans donnée), avec la base affichée.
- Établissement : intitulé et description verrouillés ; indicateur « défini par le groupe » (définition non modifiable), valeur initiale / mesures / cible locale propres ; cible du groupe rappelée.
- Associations : on relie des éléments EXISTANTS du même périmètre (risques, décisions, constats, exigences, initiatives, documents) — aucune duplication, retrait du lien sans toucher à l'élément.
- Anciens textes « indicateurs » : affichés comme « saisie antérieure » avec bouton « Convertir en indicateur chiffré ».
- Indicateur supprimable seulement sans mesures ni copies ; sinon statut « abandonné ».

## Routes ajoutées
`POST /api/objectives/[id]/diffuse` (diffusion à tous les établissements) · `PATCH /api/documents/[id]` (rattacher / détacher un document comme preuve d'un objectif, indicateur, exigence ou constat — même périmètre uniquement).

## Pas encore (Lots suivants)
Liste de pilotage en cartes et onglets (Lot 3) · sélection établissement par établissement et écran d'applicabilité des exigences (Lot 4). Modification / suppression détaillée d'une action : via la page Actions existante (le statut se change dans la fiche).
