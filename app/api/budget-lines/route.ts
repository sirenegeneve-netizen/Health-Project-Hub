import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const line = await prisma.budgetLine.create({
    data: {
      projectId: body.projectId,
      libelle: body.libelle,
      categorie: body.categorie || null,
      fournisseur: body.fournisseur || null,
      prevision: Number(body.prevision) || 0,
      engage: Number(body.engage) || 0,
      reel: Number(body.reel) || 0,
    },
  });
  await logTimelineEvent(body.projectId, "budget", `Ligne budgétaire ajoutée : « ${line.libelle} »`);
  return NextResponse.json(line, { status: 201 });
}
