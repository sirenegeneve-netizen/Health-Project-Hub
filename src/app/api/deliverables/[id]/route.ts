import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.deliverable.findUniqueOrThrow({ where: { id: params.id } });
  const item = await prisma.deliverable.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      responsable: body.responsable ?? undefined,
      datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
      dateReelle: body.dateReelle !== undefined ? (body.dateReelle ? new Date(body.dateReelle) : null) : undefined,
      version: body.version ?? undefined,
      status: body.status ?? undefined,
    },
  });
  if (body.status && body.status !== before.status) {
    await logTimelineEvent(item.projectId, "livrable", `Livrable « ${item.name} » → ${item.status}`);
  }
  return NextResponse.json(item);
}
