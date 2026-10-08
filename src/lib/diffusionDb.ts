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
    select: { id: true, strategicGoalId: true, strategicPlanId: true },
  });
  const rows: { strategicGoalId: string; strategicPlanId: string; statut: string; parentCycleId: string }[] = [];
  for (const c of groupCycles) {
    for (const estId of estIds) {
      const g = goalOf.get(`${estId}::${c.strategicGoalId}`);
      const p = planOf.get(`${estId}::${c.strategicPlanId}`);
      if (g && p) rows.push({ strategicGoalId: g, strategicPlanId: p, statut: "actif", parentCycleId: c.id });
    }
  }
  if (rows.length > 0) {
    const res = await prisma.strategicGoalCycle.createMany({ data: rows, skipDuplicates: true });
    summary.cyclesCreated = res.count;
    // Déclinaisons créées avant l'ajout du lien explicite : on le complète sans jamais l'écraser.
    for (const r of rows) {
      await prisma.strategicGoalCycle.updateMany({ where: { strategicGoalId: r.strategicGoalId, strategicPlanId: r.strategicPlanId, parentCycleId: null }, data: { parentCycleId: r.parentCycleId } });
    }
  }
  // Les cycles de groupe diffusés portent la portée « tous » (la sélection par établissement viendra ensuite).
  if (groupCycles.length > 0) {
    await prisma.strategicGoalCycle.updateMany({ where: { id: { in: groupCycles.map((c) => c.id) }, diffusion: "aucune" }, data: { diffusion: "tous" } });
    for (const c of groupCycles) await syncIndicatorsToChildren(c.id);
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

// --- Indicateurs : héritage de la définition Groupe ---------------------------------------------------------------

// Chaque déclinaison d'établissement reçoit une copie de la définition des indicateurs du groupe ;
// valeur initiale, mesures et cible locale restent propres à l'établissement. Idempotent.
export async function syncIndicatorsToChildren(groupCycleId: string): Promise<number> {
  const [indicators, children] = await Promise.all([
    prisma.goalIndicator.findMany({ where: { strategicGoalCycleId: groupCycleId } }),
    prisma.strategicGoalCycle.findMany({ where: { parentCycleId: groupCycleId }, select: { id: true } }),
  ]);
  if (indicators.length === 0 || children.length === 0) return 0;
  const existing = await prisma.goalIndicator.findMany({
    where: { strategicGoalCycleId: { in: children.map((c) => c.id) }, parentIndicatorId: { in: indicators.map((i) => i.id) } },
    select: { strategicGoalCycleId: true, parentIndicatorId: true },
  });
  const have = new Set(existing.map((e) => `${e.strategicGoalCycleId}::${e.parentIndicatorId}`));
  const rows = [];
  for (const child of children) {
    for (const ind of indicators) {
      if (have.has(`${child.id}::${ind.id}`)) continue;
      rows.push({
        strategicGoalCycleId: child.id,
        parentIndicatorId: ind.id,
        nom: ind.nom,
        description: ind.description,
        unite: ind.unite,
        sens: ind.sens,
        frequence: ind.frequence,
        principal: ind.principal,
        statut: "actif",
        // valeurInitiale / valeurCible volontairement vides : valeur propre à l'établissement, cible = celle du groupe
      });
    }
  }
  if (rows.length === 0) return 0;
  const res = await prisma.goalIndicator.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

