import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.action.findUniqueOrThrow({ where: { id: params.id } });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.responsable !== undefined) data.responsable = body.responsable;
  if (body.echeance !== undefined) {
    // Report d'échéance : on trace le nombre de reports (§19).
    if (body.echeance && before.echeance && new Date(body.echeance).getTime() !== before.echeance.getTime()) {
      data.postponedCount = before.postponedCount + 1;
    }
    data.echeance = body.echeance ? new Date(body.echeance) : null;
  }
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.status !== undefined) data.status = body.status;
  if (body.comments !== undefined) data.comments = body.comments;

  const action = await prisma.action.update({ where: { id: params.id }, data });

  if (body.status && body.status !== before.status) {
    await logTimelineEvent(action.projectId, "action", `Action « ${action.title} » → ${body.status}`);
  }
  return NextResponse.json(action);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.action.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
