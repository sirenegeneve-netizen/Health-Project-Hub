import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const stakeholder = await prisma.stakeholder.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      organisation: body.organisation ?? undefined,
      role: body.role ?? undefined,
      implication: body.implication ?? undefined,
      influence: body.influence ?? undefined,
      contact: body.contact ?? undefined,
      comments: body.comments ?? undefined,
    },
  });
  return NextResponse.json(stakeholder);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.stakeholder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
