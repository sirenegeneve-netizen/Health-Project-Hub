import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const kpi = await prisma.kpi.create({
    data: {
      initiativeId: body.initiativeId,
      name: body.name,
      value: Number(body.value),
      unit: body.unit || null,
      target: body.target ? Number(body.target) : null,
      period: body.period || null,
      categorie: body.categorie || null,
      alertThreshold: body.alertThreshold ? Number(body.alertThreshold) : null,
    },
  });
  await logTimelineEvent(body.initiativeId, "indicateur", `Indicateur ajouté : « ${kpi.name} »`);
  return NextResponse.json(kpi, { status: 201 });
}
