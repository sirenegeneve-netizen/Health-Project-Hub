import { prisma } from "@/lib/db";

// Checklists par défaut pour les 3 étapes du parcours qui n'ont pas d'indicateur
// calculable à partir de données déjà saisies ailleurs (contrairement à Cadrage,
// Déploiement, Validation, Formation & Accompagnement, Mise en production et
// Stabilisation, qui restent pilotés par src/lib/readiness.ts). Ce sont des
// checklists génériques pour l'instant — les rendre configurables par type de
// projet est prévu dans une itération suivante.
export const DEFAULT_STAGE_CRITERIA: Record<string, string[]> = {
  kickoff: ["Support de Kick-off préparé", "Compte rendu diffusé", "Planning confirmé avec les parties prenantes", "Responsabilités confirmées"],
  preparation: [
    "Prérequis techniques réunis",
    "Prérequis organisationnels réunis",
    "Établissements prêts",
    "Données disponibles",
    "Paramétrage réalisé",
    "Comptes et droits créés",
    "Environnement de déploiement prêt",
    "Planning détaillé partagé",
  ],
  cloture: [
    "Objectifs du projet atteints",
    "Livrables terminés",
    "Risques résiduels revus",
    "Budget final validé",
    "Bilan rédigé",
    "Transfert au support / à l'exploitation effectué",
  ],
};

export const STATUS_VALUES = ["non_commence", "en_cours", "bloque", "pret"] as const;
export type StageCriterionStatus = (typeof STATUS_VALUES)[number];

// Amorce la checklist par défaut d'une étape pour un projet si elle n'existe pas
// encore (idempotent — ne recrée jamais un critère déjà présent grâce à la
// contrainte unique [projectId, stageKey, label]).
export async function ensureStageCriteria(projectId: string, stageKey: string) {
  const defaults = DEFAULT_STAGE_CRITERIA[stageKey];
  if (!defaults) return;
  await prisma.stageCriterion.createMany({
    data: defaults.map((label, order) => ({ projectId, stageKey, label, order })),
    skipDuplicates: true,
  });
}

export function computeStageCompletion(criteria: { status: string }[]): { percent: number; blocked: boolean } {
  if (criteria.length === 0) return { percent: 0, blocked: false };
  const done = criteria.filter((c) => c.status === "pret").length;
  const blocked = criteria.some((c) => c.status === "bloque");
  return { percent: Math.round((done / criteria.length) * 100), blocked };
}
