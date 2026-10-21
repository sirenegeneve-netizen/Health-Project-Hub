import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("initiativeRequirementCoverage", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

  const updated = await prisma.initiativeRequirementCoverage.update({
    where: { id: params.id },
    data: { niveau: body.niveau },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const __g = await guardRecord("initiativeRequirementCoverage", params.id, "supprimer");
  if (!__g.ok) return __g.response;


  await prisma.initiativeRequirementCoverage.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
