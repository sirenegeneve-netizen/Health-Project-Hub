import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cycleIsDiffused } from "@/lib/diffusion";
import { syncGroupDiffusion } from "@/lib/diffusionDb";

// Décline un Objectif stratégique existant dans un Plan donné. Le Goal et le
// Plan doivent porter la même portée (même ownerType/ownerId) — on ne peut
// pas rattacher l'objectif d'un établissement au plan d'un autre.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { strategicGoalId, strategicPlanId } = body;
  if (!strategicGoalId || !strategicPlanId) {
    return NextResponse.json({ error: "strategicGoalId et strategicPlanId sont requis." }, { status: 400 });
  }

  const [goal, plan] = await Promise.all([
    prisma.strategicGoal.findUnique({ where: { id: strategicGoalId } }),
    prisma.strategicPlan.findUnique({ where: { id: strategicPlanId } }),
  ]);
  if (!goal || !plan) return NextResponse.json({ error: "Objectif ou plan introuvable." }, { status: 404 });
  if (goal.ownerType !== plan.ownerType || goal.ownerId !== plan.ownerId) {
    return NextResponse.json({ error: "L'objectif et le plan doivent porter sur le même groupe/établissement." }, { status: 400 });
  }

  try {
    const cycle = await prisma.strategicGoalCycle.create({
      data: {
        strategicGoalId,
        strategicPlanId,
        libelle: body.libelle || null,
        statut: body.statut || "actif",
        cible: body.cible || null,
        indicateurs: body.indicateurs || null,
      },
    });
    // Cycle d'un groupe dont l'objectif ET le plan sont diffusés : on le décline dans chaque établissement.
    if (goal.ownerType === "groupe" && cycleIsDiffused(goal, plan)) await syncGroupDiffusion(goal.ownerId);
    return NextResponse.json(cycle, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Cet objectif est déjà décliné dans ce plan." }, { status: 409 });
    }
    throw e;
  }
}
