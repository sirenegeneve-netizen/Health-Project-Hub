import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
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
