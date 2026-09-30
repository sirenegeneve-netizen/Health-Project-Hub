import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Déclare qu'une Initiative couvre une exigence qualité existante (relation
// facultative des deux côtés). Même règle de portée que pour les objectifs
// stratégiques : l'exigence doit être portée par le Groupe de l'initiative,
// ou par un Établissement de ce Groupe.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { initiativeId, qualityRequirementId } = body;
  if (!initiativeId || !qualityRequirementId) {
    return NextResponse.json({ error: "initiativeId et qualityRequirementId sont requis." }, { status: 400 });
  }

  const [initiative, requirement] = await Promise.all([
    prisma.initiative.findUnique({ where: { id: initiativeId }, select: { groupId: true } }),
    prisma.qualityRequirement.findUnique({ where: { id: qualityRequirementId } }),
  ]);
  if (!initiative || !requirement) return NextResponse.json({ error: "Initiative ou exigence introuvable." }, { status: 404 });

  let sameScope = requirement.ownerType === "groupe" && requirement.ownerId === initiative.groupId;
  if (!sameScope && requirement.ownerType === "etablissement") {
    const establishment = await prisma.establishment.findUnique({ where: { id: requirement.ownerId }, select: { groupId: true } });
    sameScope = establishment?.groupId === initiative.groupId;
  }
  if (!sameScope) {
    return NextResponse.json({ error: "Cette exigence n'appartient pas au même groupe que l'initiative." }, { status: 400 });
  }

  try {
    const coverage = await prisma.initiativeRequirementCoverage.create({
      data: { initiativeId, qualityRequirementId, niveau: body.niveau || "totale" },
    });
    return NextResponse.json(coverage, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "L'initiative couvre déjà cette exigence." }, { status: 409 });
    }
    throw e;
  }
}
