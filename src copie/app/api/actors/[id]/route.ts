import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const actor = await prisma.actor.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      fonction: body.fonction ?? undefined,
      organisation: body.organisation ?? undefined,
      roleProjet: body.roleProjet ?? undefined,
      email: body.email ?? undefined,
      telephone: body.telephone ?? undefined,
      disponibiliteJh: body.disponibiliteJh !== undefined ? (body.disponibiliteJh ? Number(body.disponibiliteJh) : null) : undefined,
      competences: body.competences ?? undefined,
    },
  });
  return NextResponse.json(actor);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.actor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
