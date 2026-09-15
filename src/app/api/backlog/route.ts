import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const item = await prisma.backlogItem.create({
    data: {
      initiativeId: body.initiativeId,
      demande: body.demande,
      origine: body.origine || null,
      description: body.description || null,
      impact: body.impact || null,
      priorite: body.priorite || "normale",
      estimationJh: body.estimationJh ? Number(body.estimationJh) : null,
    },
  });
  await logTimelineEvent(body.initiativeId, "evolution", `Demande d'évolution : « ${item.demande} »`);
  return NextResponse.json(item, { status: 201 });
}
