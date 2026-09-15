import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const release = await prisma.release.update({
    where: { id: params.id },
    data: {
      status: body.status ?? undefined,
      dateDeploiement: body.dateDeploiement !== undefined ? (body.dateDeploiement ? new Date(body.dateDeploiement) : null) : undefined,
      contenu: body.contenu ?? undefined,
    },
  });
  return NextResponse.json(release);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.release.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
