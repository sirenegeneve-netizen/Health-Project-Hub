import { prisma } from "@/lib/db";

export const CRITERIA_STAGES = ["kickoff", "preparation", "cloture"] as const;
export type CriteriaStageKey = (typeof CRITERIA_STAGES)[number];

export const DEFAULT_PROJECT_TYPE = "defaut";

export const STATUS_VALUES = ["non_commence", "en_cours", "bloque", "pret"] as const;
export type StageCriterionStatus = (typeof STATUS_VALUES)[number];

// Checklists de repli — utilisées pour amorcer le modèle "defaut" en base la
// toute première fois (voir ensureDefaultTemplates). Une fois en base, c'est
// la table StageCriterionTemplate qui fait foi et qui reste éditable depuis
// Paramètres > Critères, par type de projet.
const SEED_DEFAULT_TEMPLATES: Record<CriteriaStageKey, string[]> = {
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

// Amorce le modèle "defaut" en base s'il n'existe pas encore du tout (premier
// démarrage de l'app). Idempotent — ne touche jamais aux modèles déjà présents,
// y compris ceux que l'utilisateur aurait vidés volontairement.
export async function ensureDefaultTemplates() {
  const existing = await prisma.stageCriterionTemplate.count({ where: { projectType: DEFAULT_PROJECT_TYPE } });
  if (existing > 0) return;
  const rows = CRITERIA_STAGES.flatMap((stageKey) =>
    SEED_DEFAULT_TEMPLATES[stageKey].map((label, order) => ({ projectType: DEFAULT_PROJECT_TYPE, stageKey, label, order }))
  );
  await prisma.stageCriterionTemplate.createMany({ data: rows, skipDuplicates: true });
}

// Amorce la checklist d'un projet pour une étape donnée, à partir du modèle de
// son type — ou du modèle "defaut" si son type n'a pas de liste dédiée.
// Idempotent grâce à la contrainte unique [projectId, stageKey, label] sur
// StageCriterion : un critère déjà coché n'est jamais recréé/réinitialisé.
export async function ensureStageCriteria(projectId: string, stageKey: CriteriaStageKey, projectType: string) {
  await ensureDefaultTemplates();
  let templates = await prisma.stageCriterionTemplate.findMany({
    where: { projectType, stageKey },
    orderBy: { order: "asc" },
  });
  if (templates.length === 0 && projectType !== DEFAULT_PROJECT_TYPE) {
    templates = await prisma.stageCriterionTemplate.findMany({
      where: { projectType: DEFAULT_PROJECT_TYPE, stageKey },
      orderBy: { order: "asc" },
    });
  }
  if (templates.length === 0) return;
  await prisma.stageCriterion.createMany({
    data: templates.map((t, order) => ({ projectId, stageKey, label: t.label, order })),
    skipDuplicates: true,
  });
}

export function computeStageCompletion(criteria: { status: string }[]): { percent: number; blocked: boolean } {
  if (criteria.length === 0) return { percent: 0, blocked: false };
  const done = criteria.filter((c) => c.status === "pret").length;
  const blocked = criteria.some((c) => c.status === "bloque");
  return { percent: Math.round((done / criteria.length) * 100), blocked };
}
