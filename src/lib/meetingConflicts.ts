import { prisma } from "@/lib/db";
import { combineDateAndTime } from "@/lib/time";

// Si l'une des deux réunions (la nouvelle ou une existante) n'a pas d'heure
// de fin renseignée, on retombe sur une fenêtre de ±1h autour de son horaire
// de début comme approximation raisonnable — sans fabriquer de donnée de
// durée qui n'existe pas. Dès que les deux ont une heure de fin, on calcule
// un vrai chevauchement d'intervalles.
const WINDOW_MS = 60 * 60 * 1000;

export interface MeetingConflict {
  meetingId: string;
  title: string;
  date: string;
  initiativeId: string;
  initiativeName: string;
  sharedActorNames: string[];
}

function intervalOf(date: Date, heureFin: string | null): [number, number] {
  const end = combineDateAndTime(date, heureFin);
  if (end) return [date.getTime(), end.getTime()];
  return [date.getTime() - WINDOW_MS, date.getTime() + WINDOW_MS];
}

export async function checkMeetingConflicts(
  participantActorIds: string[],
  date: Date,
  heureFin: string | null = null,
  excludeMeetingId?: string
): Promise<MeetingConflict[]> {
  if (participantActorIds.length === 0) return [];

  const [newStart, newEnd] = intervalOf(date, heureFin);
  const dbWindowStart = new Date(newStart - WINDOW_MS);
  const dbWindowEnd = new Date(newEnd + WINDOW_MS);

  const candidates = await prisma.meeting.findMany({
    where: {
      id: excludeMeetingId ? { not: excludeMeetingId } : undefined,
      date: { gte: dbWindowStart, lte: dbWindowEnd },
      meetingParticipants: { some: { actorId: { in: participantActorIds } } },
    },
    include: {
      initiative: true,
      meetingParticipants: { include: { actor: true } },
    },
  });

  return candidates
    .filter((m) => {
      const [candStart, candEnd] = intervalOf(m.date, m.heureFin);
      return Math.max(newStart, candStart) < Math.min(newEnd, candEnd);
    })
    .map((m) => ({
      meetingId: m.id,
      title: m.title,
      date: m.date.toISOString(),
      initiativeId: m.initiativeId,
      initiativeName: m.initiative.name,
      sharedActorNames: m.meetingParticipants.filter((mp) => participantActorIds.includes(mp.actorId)).map((mp) => mp.actor.name),
    }));
}
