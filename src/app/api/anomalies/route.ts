import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const anomaly = await prisma.anomaly.create({
    data: {
      projectId: body.projectId,
      description: body.description,
      origine: body.origine || null,
      environnement: body.environnement || null,
      criticite: body.criticite || "moyenne",
      responsable: body.responsable || null,
    },
  });
  await logTimelineEvent(body.projectId, "anomalie", `Anomalie signalée : « ${anomaly.description} »`);
  return NextResponse.json(anomaly, { status: 201 });
}
