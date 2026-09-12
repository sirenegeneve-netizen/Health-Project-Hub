import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { resolveActorName } from "@/lib/actorResolve";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await prisma.trainingSession.create({
    data: {
      initiativeId: body.initiativeId,
      trainingRecordId: body.trainingRecordId,
      date: new Date(body.date),
      dureeHeures: body.dureeHeures ? Number(body.dureeHeures) : null,
      formateurActorId: body.formateurActorId || null,
      formateur: await resolveActorName(body.formateurActorId),
      format: body.format || null,
      nbInscrits: Number(body.nbInscrits) || 0,
      nbPresents: Number(body.nbPresents) || 0,
      notes: body.notes || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "formation", `Session de formation réalisée (${session.nbPresents}/${session.nbInscrits} présents)`);
  return NextResponse.json(session, { status: 201 });
}
