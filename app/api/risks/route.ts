import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const risk = await prisma.risk.create({
    data: {
      projectId: body.projectId,
      meetingId: body.meetingId || null,
      interfaceId: body.interfaceId || null,
      description: body.description,
      cause: body.cause || null,
      consequence: body.consequence || null,
      probabilite: body.probabilite || "moyenne",
      impact: body.impact || "moyen",
      criticite: body.criticite || "moyenne",
      proprietaire: body.proprietaire || null,
      planAction: body.planAction || null,
      echeance: body.echeance ? new Date(body.echeance) : null,
    },
  });
  await logTimelineEvent(body.projectId, "risque", `Risque identifié : « ${risk.description} »`);
  return NextResponse.json(risk, { status: 201 });
}
