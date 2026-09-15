import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const line = await prisma.budgetLine.update({
    where: { id: params.id },
    data: {
      libelle: body.libelle ?? undefined,
      categorie: body.categorie ?? undefined,
      fournisseur: body.fournisseur ?? undefined,
      prevision: body.prevision !== undefined ? Number(body.prevision) : undefined,
      engage: body.engage !== undefined ? Number(body.engage) : undefined,
      reel: body.reel !== undefined ? Number(body.reel) : undefined,
    },
  });
  return NextResponse.json(line);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  await prisma.budgetLine.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
