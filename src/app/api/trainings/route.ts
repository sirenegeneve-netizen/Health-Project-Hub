import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const training = await prisma.trainingRecord.create({
    data: {
      projectId: body.projectId,
      establishmentId: body.establishmentId || null,
      service: body.service || null,
      metier: body.metier || null,
      profil: body.profil || null,
      nbUsers: Number(body.nbUsers) || 0,
      nbFormes: Number(body.nbFormes) || 0,
      autonomyLevel: Number(body.autonomyLevel) || 0,
      dateFormation: body.dateFormation ? new Date(body.dateFormation) : null,
    },
  });
  await logTimelineEvent(body.projectId, "formation", `Suivi formation ajouté : ${body.profil || body.metier || "profil"}`);
  return NextResponse.json(training, { status: 201 });
}
