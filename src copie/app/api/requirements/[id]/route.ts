import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.requirement.findUniqueOrThrow({ where: { id: params.id } });
  const requirement = await prisma.requirement.update({
    where: { id: params.id },
    data: {
      titre: body.titre ?? undefined,
      description: body.description ?? undefined,
      priorite: body.priorite ?? undefined,
      statut: body.statut ?? undefined,
    },
  });
  if (body.statut && body.statut !== before.statut) {
    await logTimelineEvent(requirement.initiativeId, "besoin", `Besoin « ${requirement.titre} » → ${requirement.statut}`);
  }
  return NextResponse.json(requirement);
}
