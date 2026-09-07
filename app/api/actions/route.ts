import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = await prisma.action.create({
    data: {
      projectId: body.projectId,
      meetingId: body.meetingId || null,
      title: body.title,
      responsable: body.responsable || null,
      dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
      echeance: body.echeance ? new Date(body.echeance) : null,
      priority: body.priority || "normale",
      origine: body.origine || "manuel",
      comments: body.comments || null,
    },
  });
  await logTimelineEvent(body.projectId, "action", `Action créée : « ${action.title} »`);
  return NextResponse.json(action, { status: 201 });
}
