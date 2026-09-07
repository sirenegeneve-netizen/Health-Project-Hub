import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.backlogItem.create({
    data: {
      projectId: body.projectId,
      demande: body.demande,
      origine: body.origine || null,
      description: body.description || null,
      impact: body.impact || null,
      priorite: body.priorite || "normale",
      estimationJh: body.estimationJh ? Number(body.estimationJh) : null,
    },
  });
  await logTimelineEvent(body.projectId, "evolution", `Demande d'évolution : « ${item.demande} »`);
  return NextResponse.json(item, { status: 201 });
}
