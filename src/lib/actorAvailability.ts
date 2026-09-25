import { prisma } from "@/lib/db";

export interface UnavailableParticipant {
  actorId: string;
  actorName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

// Une réunion n'a pas de durée en base (cf. meetingConflicts.ts) : on compare
// simplement la date/heure visée à la période d'indisponibilité déclarée
// (journées entières), sans fenêtre ±1h ici — être en congé ne dépend pas de
// l'heure exacte de la réunion dans la journée.
export async function checkUnavailableParticipants(participantActorIds: string[], date: Date): Promise<UnavailableParticipant[]> {
  if (participantActorIds.length === 0) return [];

  const periods = await prisma.actorUnavailability.findMany({
    where: { actorId: { in: participantActorIds }, startDate: { lte: date }, endDate: { gte: date } },
    include: { actor: { select: { name: true } } },
  });

  return periods.map((p) => ({
    actorId: p.actorId,
    actorName: p.actor.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    reason: p.reason,
  }));
}
