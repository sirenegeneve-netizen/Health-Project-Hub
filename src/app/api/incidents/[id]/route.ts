import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

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
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.incident.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
