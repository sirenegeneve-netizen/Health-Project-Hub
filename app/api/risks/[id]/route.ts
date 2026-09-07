import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.risk.findUniqueOrThrow({ where: { id: params.id } });
  const risk = await prisma.risk.update({
    where: { id: params.id },
    data: {
      description: body.description ?? undefined,
      cause: body.cause ?? undefined,
      consequence: body.consequence ?? undefined,
      probabilite: body.probabilite ?? undefined,
      impact: body.impact ?? undefined,
      criticite: body.criticite ?? undefined,
      proprietaire: body.proprietaire ?? undefined,
      planAction: body.planAction ?? undefined,
      echeance: body.echeance !== undefined ? (body.echeance ? new Date(body.echeance) : null) : undefined,
      status: body.status ?? undefined,
    },
  });
  if (body.status && body.status !== before.status) {
    await logTimelineEvent(risk.projectId, "risque", `Risque « ${risk.description} » → ${body.status}`);
  }
  return NextResponse.json(risk);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.risk.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
