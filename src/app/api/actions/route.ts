import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();

  let responsableName: string | null = null;
  if (body.responsableActorId) {
    const actor = await prisma.actor.findUnique({ where: { id: body.responsableActorId } });
    responsableName = actor?.name || null;
  }

  const action = await prisma.action.create({
    data: {
      initiativeId: body.initiativeId,
      meetingId: body.meetingId || null,
      riskId: body.riskId || null,
      decisionId: body.decisionId || null,
      establishmentId: body.establishmentId || null,
      title: body.title,
      responsableActorId: body.responsableActorId || null,
      responsable: responsableName,
      dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
      echeance: body.echeance ? new Date(body.echeance) : null,
      priority: body.priority || "normale",
      origine: body.origine || "manuel",
      comments: body.comments || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "action", `Action créée : « ${action.title} »`);
  return NextResponse.json(action, { status: 201 });
}
