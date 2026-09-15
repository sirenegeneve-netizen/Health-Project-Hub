import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const line = await prisma.budgetLine.create({
    data: {
      initiativeId: body.initiativeId,
      libelle: body.libelle,
      categorie: body.categorie || null,
      fournisseur: body.fournisseur || null,
      prevision: Number(body.prevision) || 0,
      engage: Number(body.engage) || 0,
      reel: Number(body.reel) || 0,
    },
  });
  await logTimelineEvent(body.initiativeId, "budget", `Ligne budgétaire ajoutée : « ${line.libelle} »`);
  return NextResponse.json(line, { status: 201 });
}
