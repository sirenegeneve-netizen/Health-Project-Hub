import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const change = await prisma.changeRequest.create({
    data: {
      projectId: body.projectId,
      titre: body.titre,
      origine: body.origine || null,
      demandeur: body.demandeur || null,
      justification: body.justification || null,
      perimetre: body.perimetre || null,
      impactFonctionnel: body.impactFonctionnel || null,
      impactPlanningJours: body.impactPlanningJours ? Number(body.impactPlanningJours) : null,
      impactJh: body.impactJh ? Number(body.impactJh) : null,
      impactInterop: body.impactInterop || null,
      impactFormation: body.impactFormation || null,
      impactRisque: body.impactRisque || null,
      nouvelleDateCible: body.nouvelleDateCible ? new Date(body.nouvelleDateCible) : null,
    },
  });
  await logTimelineEvent(body.projectId, "changement", `Demande de changement enregistrée : « ${change.titre} »`);
  return NextResponse.json(change, { status: 201 });
}
