import { prisma } from "@/lib/db";
import { buildBaselineAction } from "@/lib/objectifs";

// Action « État des lieux initial » d'un objectif : on réutilise le mécanisme générique d'Action (aucun second système),
// avec l'origine « etat_des_lieux ». Une seule action par objectif : si une action non abandonnée existe déjà pour ce
// cycle, les indicateurs concernés y sont simplement rattachés (pas de doublon).
export async function ensureBaselineAction(input: {
  cycleId: string;
  indicatorIds: string[];
  overrides?: { title?: string; description?: string; livrable?: string; responsableActorId?: string | null; echeance?: string | null; priority?: string; status?: string } | null;
}): Promise<{ id: string; created: boolean } | null> {
  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: input.cycleId }, include: { strategicGoal: { select: { libelle: true, ownerType: true, ownerId: true } } } });
  if (!cycle) return null;
  const indicators = await prisma.goalIndicator.findMany({ where: { id: { in: input.indicatorIds }, strategicGoalCycleId: cycle.id }, select: { id: true, nom: true, unite: true, valeurInitiale: true } });
  const targets = indicators.filter((i) => i.valeurInitiale === null);
  if (targets.length === 0) return null;

  const existing = await prisma.action.findFirst({ where: { strategicGoalCycleId: cycle.id, origine: "etat_des_lieux", status: { not: "abandonne" } }, orderBy: { createdAt: "asc" } });
  let actionId: string;
  let created = false;
  if (existing) {
    actionId = existing.id;
  } else {
    const draft = buildBaselineAction({ objectif: cycle.strategicGoal.libelle, indicators: targets, ownerType: cycle.strategicGoal.ownerType });
    const o = input.overrides || {};
    const actor = o.responsableActorId ? await prisma.actor.findUnique({ where: { id: o.responsableActorId }, select: { name: true } }) : null;
    const action = await prisma.action.create({
      data: {
        ownerType: cycle.strategicGoal.ownerType,
        ownerId: cycle.strategicGoal.ownerId,
        establishmentId: cycle.strategicGoal.ownerType === "etablissement" ? cycle.strategicGoal.ownerId : null,
        strategicGoalCycleId: cycle.id,
        indicatorId: targets.length === 1 ? targets[0].id : null,
        title: o.title?.trim() || draft.title,
        comments: o.description?.trim() || draft.description,
        livrable: o.livrable?.trim() || draft.livrable,
        responsableActorId: o.responsableActorId || null,
        responsable: actor?.name || null,
        priority: o.priority || "haute",
        echeance: o.echeance ? new Date(o.echeance) : null,
        status: o.status || "a_faire",
        origine: "etat_des_lieux",
      },
    });
    actionId = action.id;
    created = true;
  }
  await prisma.goalIndicator.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { baselineActionId: actionId } });
  return { id: actionId, created };
}
