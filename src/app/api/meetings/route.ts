import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";
import { checkMeetingConflicts } from "@/lib/meetingConflicts";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const participantActorIds: string[] = Array.isArray(body.participantActorIds) ? body.participantActorIds : [];
  const date = new Date(body.date);

  if (!body.force) {
    const conflicts = await checkMeetingConflicts(participantActorIds, date);
    if (conflicts.length > 0) {
      return NextResponse.json({ conflicts }, { status: 409 });
    }
  }

  let participantsLegacy: string | null = null;
  if (participantActorIds.length > 0) {
    const actors = await prisma.actor.findMany({ where: { id: { in: participantActorIds } } });
    participantsLegacy = actors.map((a) => a.name).join(", ");
  }

  const meeting = await prisma.meeting.create({
    data: {
      initiativeId: body.initiativeId,
      type: body.type || "suivi",
      title: body.title,
      date,
      participants: participantsLegacy,
      agenda: body.agenda || null,
      meetingParticipants: { create: participantActorIds.map((actorId) => ({ actorId })) },
    },
  });
  await logTimelineEvent(body.initiativeId, "reunion", `Réunion planifiée : « ${meeting.title} »`);
  return NextResponse.json(meeting, { status: 201 });
}
