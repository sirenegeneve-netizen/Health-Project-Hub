import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncGroupDiffusion } from "@/lib/diffusionDb";

// Diffuse un objectif de GROUPE à tous les établissements rattachés : copie verrouillée de l'intitulé et de la
// description, définition des indicateurs héritée, déclinaison vide à renseigner par chaque établissement.
// (La sélection établissement par établissement viendra ensuite.) Une diffusion ne se retire pas.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const cycle = await prisma.strategicGoalCycle.findUnique({ where: { id: params.id }, include: { strategicGoal: true, strategicPlan: true } });
  if (!cycle) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
  if (cycle.strategicGoal.ownerType !== "groupe" || cycle.parentCycleId) {
    return NextResponse.json({ error: "Seul un objectif propre au groupe peut être diffusé." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.strategicGoal.update({ where: { id: cycle.strategicGoalId }, data: { diffuse: true } }),
    prisma.strategicPlan.update({ where: { id: cycle.strategicPlanId }, data: { diffuse: true } }),
    prisma.strategicGoalCycle.update({ where: { id: cycle.id }, data: { diffusion: "tous" } }),
  ]);
  const summary = await syncGroupDiffusion(cycle.strategicGoal.ownerId);
  await logAudit({ entityType: "objectif", entityId: cycle.id, entityLabel: cycle.strategicGoal.libelle.slice(0, 120), action: "update", changes: { diffusion: { from: "aucune", to: `tous les établissements (${summary.establishments})` } }, user });
  return NextResponse.json({ ok: true, ...summary });
}
