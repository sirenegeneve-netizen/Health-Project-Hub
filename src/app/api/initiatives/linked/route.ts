import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkflowStages } from "@/lib/workflowStages";

// Crée une initiative "compagne" à partir d'une suggestion méthodologique
// (§28 : "Ce projet semble nécessiter une initiative Cybersécurité") et la lie
// immédiatement à l'initiative d'origine. Reprend le même groupe et les mêmes
// établissements que l'initiative source — l'utilisateur ajuste ensuite si besoin.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sourceInitiativeId, relatedType, relationType, reference, name } = body;

  const source = await prisma.initiative.findUnique({
    where: { id: sourceInitiativeId },
    include: { establishments: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Initiative source introuvable." }, { status: 404 });
  }

  const stages = await getWorkflowStages(relatedType);
  const initialPhase = stages[0]?.key || "cadrage";

  const linked = await prisma.initiative.create({
    data: {
      reference,
      name,
      type: relatedType,
      groupId: source.groupId,
      status: "actif",
      phase: initialPhase,
      priority: "normale",
      establishments: {
        create: source.establishments.map((e) => ({ establishmentId: e.establishmentId })),
      },
    },
  });

  await prisma.initiativeRelation.create({
    data: {
      initiativeSourceId: sourceInitiativeId,
      initiativeCibleId: linked.id,
      type: relationType || "lie_a",
      note: `Suggérée automatiquement depuis « ${source.name} »`,
      auto: false,
    },
  });

  return NextResponse.json(linked, { status: 201 });
}
