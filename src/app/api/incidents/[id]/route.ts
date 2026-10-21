import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("incident", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

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
  const __g = await guardRecord("incident", params.id, "supprimer");
  if (!__g.ok) return __g.response;


  await prisma.incident.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
