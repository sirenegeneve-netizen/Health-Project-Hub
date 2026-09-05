import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kpi = await prisma.kpi.create({
    data: {
      projectId: body.projectId,
      name: body.name,
      value: Number(body.value),
      unit: body.unit || null,
      target: body.target ? Number(body.target) : null,
      period: body.period || null,
      alertThreshold: body.alertThreshold ? Number(body.alertThreshold) : null,
    },
  });
  await logTimelineEvent(body.projectId, "indicateur", `Indicateur ajouté : « ${kpi.name} »`);
  return NextResponse.json(kpi, { status: 201 });
}
