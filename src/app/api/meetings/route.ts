import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const participantActorIds: string[] = Array.isArray(body.participantActorIds) ? body.participantActorIds : [];

  let participantsLegacy: string | null = null;
  if (participantActorIds.length > 0) {
    const actors = await prisma.actor.findMany({ where: { id: { in: participantActorIds } } });
    participantsLegacy = actors.map((a) => a.name).join(", ");
  }

  const meeting = await prisma.meeting.create({
    data: {
      projectId: body.projectId,
      type: body.type || "suivi",
      title: body.title,
      date: new Date(body.date),
      participants: participantsLegacy,
      agenda: body.agenda || null,
      meetingParticipants: { create: participantActorIds.map((actorId) => ({ actorId })) },
    },
  });
  await logTimelineEvent(body.projectId, "reunion", `Réunion planifiée : « ${meeting.title} »`);
  return NextResponse.json(meeting, { status: 201 });
}
