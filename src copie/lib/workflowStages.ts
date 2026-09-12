import { prisma } from "@/lib/db";
import { DEFAULT_STAGES, type WorkflowStageDef } from "@/lib/lifecycle";

// Charge la séquence d'étapes configurée en base pour un type d'initiative
// (Paramètres > Workflows, à venir). Si rien n'est encore seedé pour ce type
// (avant l'exécution de prisma/seed-workflow-stages.ts, ou un type sans
// séquence dédiée), retombe sur le socle par défaut (Déploiement) pour ne
// jamais laisser un parcours vide.
export async function getWorkflowStages(initiativeType: string): Promise<WorkflowStageDef[]> {
  const rows = await prisma.workflowStage.findMany({
    where: { initiativeType },
    orderBy: { ordre: "asc" },
  });
  if (rows.length === 0) return DEFAULT_STAGES;
  return rows.map((r) => ({ key: r.key, label: r.label, legacyPhases: r.legacyPhases }));
}

// Variante groupée : charge toutes les séquences en une seule requête, utile
// pour les listes/tableaux de bord qui calculent l'étape courante de
// plusieurs initiatives de types différents sans faire une requête par ligne.
export async function getAllWorkflowStagesGrouped(): Promise<Record<string, WorkflowStageDef[]>> {
  const rows = await prisma.workflowStage.findMany({ orderBy: { ordre: "asc" } });
  const grouped: Record<string, WorkflowStageDef[]> = {};
  for (const r of rows) {
    if (!grouped[r.initiativeType]) grouped[r.initiativeType] = [];
    grouped[r.initiativeType].push({ key: r.key, label: r.label, legacyPhases: r.legacyPhases });
  }
  return grouped;
}

export function stagesForType(grouped: Record<string, WorkflowStageDef[]>, initiativeType: string): WorkflowStageDef[] {
  return grouped[initiativeType]?.length ? grouped[initiativeType] : DEFAULT_STAGES;
}
