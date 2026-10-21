import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("kpi", body);
  if (!__g.ok) return __g.response;

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
