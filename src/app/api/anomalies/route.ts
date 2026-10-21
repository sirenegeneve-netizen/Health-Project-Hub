import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("anomaly", body);
  if (!__g.ok) return __g.response;

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
