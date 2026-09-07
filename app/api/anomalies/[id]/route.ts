import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const before = await prisma.anomaly.findUniqueOrThrow({ where: { id: params.id } });
  const anomaly = await prisma.anomaly.update({
    where: { id: params.id },
    data: {
      description: body.description ?? undefined,
      criticite: body.criticite ?? undefined,
      responsable: body.responsable ?? undefined,
      correction: body.correction ?? undefined,
      dateCorrection: body.dateCorrection !== undefined ? (body.dateCorrection ? new Date(body.dateCorrection) : null) : undefined,
      status: body.status ?? undefined,
    },
  });
  if (body.status && body.status !== before.status) {
    await logTimelineEvent(anomaly.projectId, "anomalie", `Anomalie « ${anomaly.description} » → ${anomaly.status}`);
  }
  return NextResponse.json(anomaly);
}
