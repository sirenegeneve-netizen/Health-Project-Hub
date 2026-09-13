import { prisma } from "@/lib/db";

// Le modèle Meeting n'a pas de durée — on retient une fenêtre de ±1h autour de
// l'horaire visé comme approximation raisonnable d'un créneau de réunion, sans
// fabriquer de donnée de durée qui n'existe pas. Non bloquant par conception :
// l'appelant décide quoi faire du résultat (§7 du prompt Planning).
const WINDOW_MS = 60 * 60 * 1000;

export interface MeetingConflict {
  meetingId: string;
  title: string;
  date: string;
  initiativeId: string;
  initiativeName: string;
  sharedActorNames: string[];
}

export async function checkMeetingConflicts(
  participantActorIds: string[],
  date: Date,
  excludeMeetingId?: string
): Promise<MeetingConflict[]> {
  if (participantActorIds.length === 0) return [];

  const windowStart = new Date(date.getTime() - WINDOW_MS);
  const windowEnd = new Date(date.getTime() + WINDOW_MS);

  const candidates = await prisma.meeting.findMany({
    where: {
      id: excludeMeetingId ? { not: excludeMeetingId } : undefined,
      date: { gte: windowStart, lte: windowEnd },
      meetingParticipants: { some: { actorId: { in: participantActorIds } } },
    },
    include: {
      initiative: true,
      meetingParticipants: { include: { actor: true } },
    },
  });

  return candidates.map((m) => ({
    meetingId: m.id,
    title: m.title,
    date: m.date.toISOString(),
    initiativeId: m.initiativeId,
    initiativeName: m.initiative.name,
    sharedActorNames: m.meetingParticipants.filter((mp) => participantActorIds.includes(mp.actorId)).map((mp) => mp.actor.name),
  }));
}
