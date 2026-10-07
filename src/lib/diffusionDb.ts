import { prisma } from "@/lib/db";
import { missingChildren } from "@/lib/diffusion";

// Diffusion groupe → établissements (accès base). Idempotent : peut être relancé à tout moment
// (création d'un établissement, nouvel objectif diffusé, bouton « Resynchroniser »). N'écrase jamais
// la cible, les indicateurs ou le statut saisis par un établissement ; ne supprime rien.

export interface DiffusionSummary {
  establishments: number;
  plansCreated: number;
  goalsCreated: number;
  cyclesCreated: number;
}

export async function syncGroupDiffusion(groupId: string): Promise<DiffusionSummary> {
  const establishments = await prisma.establishment.findMany({ where: { groupId }, select: { id: true } });
  const estIds = establishments.map((e) => e.id);
  const summary: DiffusionSummary = { establishments: estIds.length, plansCreated: 0, goalsCreated: 0, cyclesCreated: 0 };
  if (estIds.length === 0) return summary;

  const [plans, goals] = await Promise.all([
    prisma.strategicPlan.findMany({ where: { ownerType: "groupe", ownerId: groupId, diffuse: true } }),
    prisma.strategicGoal.findMany({ where: { ownerType: "groupe", ownerId: groupId, diffuse: true } }),
  ]);

  // 1) Copies de plans et d'objectifs pour chaque établissement.
  const existingPlans = await prisma.strategicPlan.findMany({
    where: { ownerType: "etablissement", ownerId: { in: estIds }, parentPlanId: { in: plans.map((p) => p.id) } },
    select: { id: true, ownerId: true, parentPlanId: true },
  });
  const missingPlans = missingChildren(plans.map((p) => p.id), estIds, existingPlans.map((p) => ({ ownerId: p.ownerId, parentId: p.parentPlanId })));
  if (missingPlans.length > 0) {
    const byId = new Map(plans.map((p) => [p.id, p]));
    const res = await prisma.strategicPlan.createMany({
      data: missingPlans.map((m) => {
        const parent = byId.get(m.parentId)!;
        return { ownerType: "etablissement", ownerId: m.establishmentId, libelle: parent.libelle, startDate: parent.startDate, endDate: parent.endDate, statut: parent.statut, parentPlanId: parent.id };
      }),
      skipDuplicates: true,
    });
    summary.plansCreated = res.count;
  }

  const existingGoals = await prisma.strategicGoal.findMany({
    where: { ownerType: "etablissement", ownerId: { in: estIds }, parentGoalId: { in: goals.map((g) => g.id) } },
    select: { id: true, ownerId: true, parentGoalId: true },
  });
  const missingGoals = missingChildren(goals.map((g) => g.id), estIds, existingGoals.map((g) => ({ ownerId: g.ownerId, parentId: g.parentGoalId })));
  if (missingGoals.length > 0) {
    const byId = new Map(goals.map((g) => [g.id, g]));
    const res = await prisma.strategicGoal.createMany({
      data: missingGoals.map((m) => {
        const parent = byId.get(m.parentId)!;
        return { ownerType: "etablissement", ownerId: m.establishmentId, libelle: parent.libelle, description: parent.description, parentGoalId: parent.id };
      }),
      skipDuplicates: true,
    });
    summary.goalsCreated = res.count;
  }

  // 2) Déclinaison : chaque cycle (objectif diffusé × plan diffusé) du groupe est décliné, vide, dans chaque
  //    établissement — la cible et les indicateurs sont à saisir par l'établissement.
  const childPlans = await prisma.strategicPlan.findMany({
    where: { ownerType: "etablissement", ownerId: { in: estIds }, parentPlanId: { in: plans.map((p) => p.id) } },
    select: { id: true, ownerId: true, parentPlanId: true },
  });
  const childGoals = await prisma.strategicGoal.findMany({
    where: { ownerType: "etablissement", ownerId: { in: estIds }, parentGoalId: { in: goals.map((g) => g.id) } },
    select: { id: true, ownerId: true, parentGoalId: true },
  });
  const planOf = new Map(childPlans.map((p) => [`${p.ownerId}::${p.parentPlanId}`, p.id]));
  const goalOf = new Map(childGoals.map((g) => [`${g.ownerId}::${g.parentGoalId}`, g.id]));

  const groupCycles = await prisma.strategicGoalCycle.findMany({
    where: { strategicGoalId: { in: goals.map((g) => g.id) }, strategicPlanId: { in: plans.map((p) => p.id) } },
    select: { strategicGoalId: true, strategicPlanId: true },
  });
  const rows: { strategicGoalId: string; strategicPlanId: string; statut: string }[] = [];
  for (const c of groupCycles) {
    for (const estId of estIds) {
      const g = goalOf.get(`${estId}::${c.strategicGoalId}`);
      const p = planOf.get(`${estId}::${c.strategicPlanId}`);
      if (g && p) rows.push({ strategicGoalId: g, strategicPlanId: p, statut: "actif" });
    }
  }
  if (rows.length > 0) {
    const res = await prisma.strategicGoalCycle.createMany({ data: rows, skipDuplicates: true });
    summary.cyclesCreated = res.count;
  }
  return summary;
}

// Propage aux établissements le libellé / la description d'un objectif du groupe diffusé.
export async function propagateGoalToChildren(goalId: string) {
  const parent = await prisma.strategicGoal.findUnique({ where: { id: goalId } });
  if (!parent || !parent.diffuse) return 0;
  const res = await prisma.strategicGoal.updateMany({ where: { parentGoalId: goalId }, data: { libelle: parent.libelle, description: parent.description } });
  return res.count;
}

// Propage libellé, dates et statut d'un plan du groupe diffusé.
export async function propagatePlanToChildren(planId: string) {
  const parent = await prisma.strategicPlan.findUnique({ where: { id: planId } });
  if (!parent || !parent.diffuse) return 0;
  const res = await prisma.strategicPlan.updateMany({
    where: { parentPlanId: planId },
    data: { libelle: parent.libelle, startDate: parent.startDate, endDate: parent.endDate, statut: parent.statut },
  });
  return res.count;
}
