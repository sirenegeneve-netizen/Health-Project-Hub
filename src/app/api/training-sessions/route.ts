import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await prisma.trainingSession.create({
    data: {
      projectId: body.projectId,
      trainingRecordId: body.trainingRecordId,
      date: new Date(body.date),
      dureeHeures: body.dureeHeures ? Number(body.dureeHeures) : null,
      formateur: body.formateur || null,
      format: body.format || null,
      nbInscrits: Number(body.nbInscrits) || 0,
      nbPresents: Number(body.nbPresents) || 0,
      notes: body.notes || null,
    },
  });
  await logTimelineEvent(body.projectId, "formation", `Session de formation réalisée (${session.nbPresents}/${session.nbInscrits} présents)`);
  return NextResponse.json(session, { status: 201 });
}
