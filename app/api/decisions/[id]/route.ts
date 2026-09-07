import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    await logTimelineEvent(decision.projectId, "decision", `Décision « ${decision.subject} » → ${body.status}`);
  }
  return NextResponse.json(decision);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.decision.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
