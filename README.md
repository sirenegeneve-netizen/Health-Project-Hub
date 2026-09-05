# Health Project Hub

Cockpit, outil de collaboration et mémoire vivante des projets numériques en santé.

Cette première version est une **fondation fonctionnelle**, construite pour être étendue module par module — elle ne couvre pas encore les 41 sections du cahier des charges à l'identique. Voir la section [Roadmap](#roadmap--ce-qui-nest-pas-encore-fait) en bas de ce document pour un état honnête de ce qui est fait, esquissé, ou pas encore commencé.

## Stack technique

- **Next.js 14** (App Router) + **TypeScript** — un seul projet full-stack (pages + API routes)
- **Prisma** + **SQLite** — base de données locale, zéro configuration. Facile à remplacer par PostgreSQL en production (changer `provider` et `DATABASE_URL` dans `prisma/schema.prisma`)
- **Tailwind CSS** — styles utilitaires, thème dédié (voir `tailwind.config.ts`)

Aucune dépendance externe payante, aucune clé d'API requise.

## Démarrage

```bash
npm install
cp .env.example .env
npm run db:push      # crée la base SQLite à partir du schéma Prisma
npm run db:seed       # (optionnel) injecte un projet d'exemple avec des données réalistes
npm run dev
```

L'application est disponible sur http://localhost:3000.

## Structure du projet

```
prisma/
  schema.prisma       # modèle de données complet
  seed.ts              # jeu de données d'exemple
src/
  app/
    page.tsx           # dashboard portefeuille (groupe)
    projects/[id]/      # cockpit projet + sous-modules (onglets)
    search/             # recherche transversale
    api/                # routes API (CRUD par entité)
  components/           # formulaires et composants UI réutilisables
  lib/
    healthScore.ts       # calcul du niveau de santé projet (explicable)
    timeline.ts           # journalisation automatique des événements
    mailSuggest.ts         # heuristique de suggestion à l'import d'un mail/document
```

## Ce qui est implémenté

- **Hiérarchie** Groupe → Établissement → Projet (§4)
- **Fiche projet** complète : type, statut, phase, priorité, chef de projet, sponsor, budget JH (§5)
- **Planning avec historique de baselines** : un changement de date cible crée une nouvelle révision au lieu d'écraser le planning initial (§8)
- **Réunions** avec synthèse automatique de préparation (actions en retard/ouvertes/terminées, risques, décisions en attente, points de vigilance, événements survenus depuis la dernière réunion) et saisie rapide pendant la séance (§16, §17, §18)
- **Registres** Actions, Risques, Décisions, Interfaces, Anomalies, chacun avec statuts et traçabilité (§19-21, §13, §24)
- **Points de vigilance** requalifiables en action / risque / décision / évolution (§22)
- **Formation & autonomie utilisateurs** avec l'échelle 0-4 du cahier des charges — "formation réalisée ≠ autonomie acquise" (§26-27)
- **Checklist Go/No Go** dérivée en direct des données du projet (interfaces bloquantes, anomalies critiques, taux d'autonomie) (§28)
- **Health Score explicable** (vert/orange/rouge + les raisons, pas juste une couleur) (§40)
- **Timeline / mémoire du projet**, alimentée automatiquement à chaque création ou changement de statut, sans double saisie (§35)
- **Recherche globale** transversale (projets, actions, risques, décisions, interfaces, réunions, documents, points de vigilance) (§36)
- **Import de document/mail** avec suggestion heuristique (mots-clés de retard + noms d'interfaces connues) — l'utilisateur valide ou ignore, rien n'est créé automatiquement (§34)
- **Backlog / amélioration continue** (§32)

## Roadmap — ce qui n'est pas encore fait

Pour rester livrable, ces modules du cahier des charges sont **volontairement laissés de côté ou simplifiés** :

- **Suggestions automatiques structurées** (§2-3) : l'analyse de texte est une heuristique par mots-clés, pas un moteur IA. Elle peut être remplacée par un appel à un LLM sans changer le contrat de l'API (`src/lib/mailSuggest.ts`).
- **Registre des changements** dédié (§15) — actuellement, une révision de planning est tracée, mais pas encore la fiche de changement complète (impact fonctionnel/JH/interop/formation).
- **Module Tests & recette** détaillé (§23) et **Migration/reprise de données** (§25) — non modélisés.
- **Gestion RACI** par activité/livrable et **annuaire d'acteurs** structuré (§11) — les responsables sont aujourd'hui des champs texte libres plutôt que des fiches Acteur reliées.
- **Génération automatique de documents** (compte rendu, synthèse projet, support COPIL) et **exports** Excel/PDF/Word (§37-38).
- **Hypercare / passage en RUN** comme étapes outillées avec leurs propres indicateurs (§30-31) — la phase existe dans le cycle de vie du projet, mais sans tableau de bord dédié.
- **Dashboard Établissement** distinct du dashboard Groupe (§39) — seule la vue Groupe et la vue Projet existent aujourd'hui.
- **Authentification / gestion des droits** — l'application n'a pas de notion d'utilisateur connecté pour l'instant.

Le schéma Prisma laisse la place pour brancher ces modules (`DocumentRef`, `TimelineEvent`, `BacklogItem` sont conçus comme des points d'extension génériques).

## Principe directeur conservé

Toute information saisie une fois (une réunion, un mail, une décision) se retrouve automatiquement dans la timeline du projet et alimente le health score — sans ressaisie. C'est le fil conducteur du cahier des charges, et c'est ce que ce socle applique déjà de bout en bout sur le périmètre implémenté.
