import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords, truncateLabel } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

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
  if (body.status && body.status !== before.status && risk.initiativeId) {
    await logTimelineEvent(risk.initiativeId, "risque", `Risque « ${risk.description} » → ${body.status}`);
  }
  await logAudit({ entityType: "risk", entityId: risk.id, entityLabel: truncateLabel(risk.description), action: "update", changes: diffRecords(before, risk), user });
  return NextResponse.json(risk);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const before = await prisma.risk.findUnique({ where: { id: params.id } });
  await prisma.risk.delete({ where: { id: params.id } });
  if (before) {
    await logAudit({ entityType: "risk", entityId: params.id, entityLabel: truncateLabel(before.description), action: "delete", user });
  }
  return NextResponse.json({ ok: true });
}
