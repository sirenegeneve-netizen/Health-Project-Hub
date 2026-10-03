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
    "Objectifs de l'initiative atteints",
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
  const existing = await prisma.stageCriterionTemplate.count({ where: { initiativeType: DEFAULT_PROJECT_TYPE } });
  if (existing > 0) return;
  const rows = CRITERIA_STAGES.flatMap((stageKey) =>
    SEED_DEFAULT_TEMPLATES[stageKey].map((label, order) => ({ initiativeType: DEFAULT_PROJECT_TYPE, stageKey, label, order }))
  );
  await prisma.stageCriterionTemplate.createMany({ data: rows, skipDuplicates: true });
}

// Amorce la checklist d'un projet pour une étape donnée, à partir du modèle de
// son type — ou du modèle "defaut" si son type n'a pas de liste dédiée.
// Idempotent grâce à la contrainte unique [initiativeId, stageKey, label] sur
// StageCriterion : un critère déjà coché n'est jamais recréé/réinitialisé.
export async function ensureStageCriteria(initiativeId: string, stageKey: CriteriaStageKey, initiativeType: string) {
  // Initiative dont le parcours a été copié depuis un modèle de projet et qui contient cette étape :
  // ses critères ont déjà été copiés (figés) à la création ou par la migration — on ne les complète
  // jamais depuis les listes par type, sinon une modification ultérieure de ces listes changerait
  // silencieusement une initiative en cours. Une étape absente de la copie (ex. la page Préparation
  // d'une initiative de Déploiement migrée) garde le comportement historique ci-dessous.
  const owner = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { templateId: true } });
  if (owner?.templateId) {
    const stage = await prisma.initiativeStage.findUnique({ where: { initiativeId_key: { initiativeId, key: stageKey } }, select: { id: true } });
    if (stage) return;
  }

  await ensureDefaultTemplates();
  let templates = await prisma.stageCriterionTemplate.findMany({
    where: { initiativeType, stageKey },
    orderBy: { order: "asc" },
  });
  if (templates.length === 0 && initiativeType !== DEFAULT_PROJECT_TYPE) {
    templates = await prisma.stageCriterionTemplate.findMany({
      where: { initiativeType: DEFAULT_PROJECT_TYPE, stageKey },
      orderBy: { order: "asc" },
    });
  }
  if (templates.length === 0) return;
  await prisma.stageCriterion.createMany({
    data: templates.map((t, order) => ({ initiativeId, stageKey, label: t.label, order })),
    skipDuplicates: true,
  });
}

export function computeStageCompletion(criteria: { status: string }[]): { percent: number; blocked: boolean } {
  if (criteria.length === 0) return { percent: 0, blocked: false };
  const done = criteria.filter((c) => c.status === "pret").length;
  const blocked = criteria.some((c) => c.status === "bloque");
  return { percent: Math.round((done / criteria.length) * 100), blocked };
}
