import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const updated = await prisma.strategicGoalCycle.update({
    where: { id: params.id },
    data: {
      libelle: body.libelle,
      statut: body.statut,
      cible: body.cible,
      indicateurs: body.indicateurs,
    },
  });
  return NextResponse.json(updated);
}
