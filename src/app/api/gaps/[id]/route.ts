import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.gap.findUniqueOrThrow({ where: { id: params.id } });
  const gap = await prisma.gap.update({
    where: { id: params.id },
    data: {
      description: body.description ?? undefined,
      optionsEnvisagees: body.optionsEnvisagees ?? undefined,
      decisionRetenue: body.decisionRetenue ?? undefined,
      impact: body.impact ?? undefined,
      statut: body.statut ?? undefined,
    },
  });
  if (body.statut && body.statut !== before.statut) {
    await logTimelineEvent(gap.initiativeId, "ecart", `Écart « ${gap.description} » → ${gap.statut}`);
  }
  return NextResponse.json(gap);
}
