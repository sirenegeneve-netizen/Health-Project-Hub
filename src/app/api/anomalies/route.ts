import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const anomaly = await prisma.anomaly.create({
    data: {
      initiativeId: body.initiativeId,
      description: body.description,
      origine: body.origine || null,
      environnement: body.environnement || null,
      criticite: body.criticite || "moyenne",
      responsable: body.responsable || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "anomalie", `Anomalie signalée : « ${anomaly.description} »`);
  return NextResponse.json(anomaly, { status: 201 });
}
