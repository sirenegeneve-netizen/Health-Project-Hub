import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  await prisma.budgetLine.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
