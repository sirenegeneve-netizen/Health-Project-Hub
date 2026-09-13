import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const incident = await prisma.incident.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      resolution: body.resolution ?? undefined,
      dateResolution: body.status === "resolu" || body.status === "cloture" ? new Date() : undefined,
      problemId: body.problemId !== undefined ? body.problemId || null : undefined,
    },
  });
  return NextResponse.json(incident);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.incident.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
