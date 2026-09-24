import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords, truncateLabel } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const before = await prisma.decision.findUniqueOrThrow({ where: { id: params.id } });
  const decision = await prisma.decision.update({
    where: { id: params.id },
    data: {
      subject: body.subject ?? undefined,
      context: body.context ?? undefined,
      options: body.options ?? undefined,
      recommendation: body.recommendation ?? undefined,
      decideur: body.decideur ?? undefined,
      decision: body.decision ?? undefined,
      date: body.date !== undefined ? (body.date ? new Date(body.date) : null) : undefined,
      impact: body.impact ?? undefined,
      status: body.status ?? undefined,
    },
  });
  if (body.status && body.status !== before.status) {
    if (decision.initiativeId) {
      await logTimelineEvent(decision.initiativeId, "decision", `Décision « ${decision.subject} » → ${body.status}`);
    }
  }
  await logAudit({ entityType: "decision", entityId: decision.id, entityLabel: truncateLabel(decision.subject), action: "update", changes: diffRecords(before, decision), user });
  return NextResponse.json(decision);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const before = await prisma.decision.findUnique({ where: { id: params.id } });
  await prisma.decision.delete({ where: { id: params.id } });
  if (before) {
    await logAudit({ entityType: "decision", entityId: params.id, entityLabel: truncateLabel(before.subject), action: "delete", user });
  }
  return NextResponse.json({ ok: true });
}
