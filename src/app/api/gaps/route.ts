import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const gap = await prisma.gap.create({
    data: {
      initiativeId: body.initiativeId,
      requirementId: body.requirementId || null,
      description: body.description,
      optionsEnvisagees: body.optionsEnvisagees || null,
      decisionRetenue: body.decisionRetenue || null,
      impact: body.impact || null,
    },
  });
  await logTimelineEvent(body.initiativeId, "ecart", `Écart identifié : « ${gap.description} »`);
  return NextResponse.json(gap, { status: 201 });
}
