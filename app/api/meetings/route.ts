import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const meeting = await prisma.meeting.create({
    data: {
      projectId: body.projectId,
      type: body.type || "suivi",
      title: body.title,
      date: new Date(body.date),
      participants: body.participants || null,
      agenda: body.agenda || null,
    },
  });
  await logTimelineEvent(body.projectId, "reunion", `Réunion planifiée : « ${meeting.title} »`);
  return NextResponse.json(meeting, { status: 201 });
}
