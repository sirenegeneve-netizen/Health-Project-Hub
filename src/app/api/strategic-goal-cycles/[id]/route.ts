import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardRecord } from "@/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardRecord("strategicGoalCycle", params.id, "modifier", body);
  if (!__g.ok) return __g.response;

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
