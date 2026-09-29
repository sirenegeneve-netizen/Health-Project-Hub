import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Rattache une Initiative existante à un StrategicGoalCycle existant
// (relation many-to-many facultative des deux côtés). Le cycle doit être
// porté par le Groupe de l'initiative, ou par un Établissement de ce Groupe —
// pas de rattachement cross-groupe (même règle que initiative-establishments).
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { initiativeId, strategicGoalCycleId } = body;
  if (!initiativeId || !strategicGoalCycleId) {
    return NextResponse.json({ error: "initiativeId et strategicGoalCycleId sont requis." }, { status: 400 });
  }

  const [initiative, cycle] = await Promise.all([
    prisma.initiative.findUnique({ where: { id: initiativeId }, select: { groupId: true } }),
    prisma.strategicGoalCycle.findUnique({ where: { id: strategicGoalCycleId }, include: { strategicGoal: true } }),
  ]);
  if (!initiative || !cycle) return NextResponse.json({ error: "Initiative ou cycle d'objectif introuvable." }, { status: 404 });

  const owner = cycle.strategicGoal;
  let sameScope = owner.ownerType === "groupe" && owner.ownerId === initiative.groupId;
  if (!sameScope && owner.ownerType === "etablissement") {
    const establishment = await prisma.establishment.findUnique({ where: { id: owner.ownerId }, select: { groupId: true } });
    sameScope = establishment?.groupId === initiative.groupId;
  }
  if (!sameScope) {
    return NextResponse.json({ error: "Cet objectif n'appartient pas au même groupe que l'initiative." }, { status: 400 });
  }

  try {
    const contribution = await prisma.initiativeGoalContribution.create({
      data: { initiativeId, strategicGoalCycleId, niveau: body.niveau || "principale" },
    });
    return NextResponse.json(contribution, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "L'initiative contribue déjà à cet objectif." }, { status: 409 });
    }
    throw e;
  }
}
