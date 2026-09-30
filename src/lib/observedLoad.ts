import { prisma } from "@/lib/db";
import { mondayOf, isoDate } from "@/lib/weeks";
import { hoursBetween } from "@/lib/time";

// Charge "constatée" = calculée automatiquement à partir des événements du
// calendrier (réunions avec heure de fin, sessions de formation, livrables
// programmés) et de qui y est impliqué. C'est un lecture seule, distincte de
// la charge "déclarée" (ActorAllocation, en JH, saisie manuellement) — les
// deux cohabitent, l'une ne remplace pas l'autre. On n'invente jamais de
// durée : un événement sans heure de fin renseignée n'est simplement pas
// compté.
export interface ObservedLoadEntry {
  actorId: string;
  weekStart: string; // isoDate du lundi
  hours: number;
  source: "reunion" | "formation" | "livrable";
  label: string;
}

export async function computeObservedLoad(rangeStart: Date, rangeEnd: Date, initiativeScope?: object): Promise<ObservedLoadEntry[]> {
  const entries: ObservedLoadEntry[] = [];

  const meetings = await prisma.meeting.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd }, heureFin: { not: null }, initiative: initiativeScope },
    include: { meetingParticipants: true },
  });
  for (const m of meetings) {
    const hours = hoursBetween(m.date, m.date.toTimeString().slice(0, 5), m.heureFin);
    if (!hours) continue;
    const weekStart = isoDate(mondayOf(m.date));
    for (const p of m.meetingParticipants) {
      entries.push({ actorId: p.actorId, weekStart, hours, source: "reunion", label: m.title });
    }
  }

  const sessions = await prisma.trainingSession.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd }, formateurActorId: { not: null }, dureeHeures: { not: null }, initiative: initiativeScope },
  });
  for (const s of sessions) {
    if (!s.formateurActorId || !s.dureeHeures) continue;
    const weekStart = isoDate(mondayOf(s.date));
    entries.push({ actorId: s.formateurActorId, weekStart, hours: s.dureeHeures, source: "formation", label: "Session de formation (formateur)" });
  }

  const deliverables = await prisma.deliverable.findMany({
    where: {
      datePrevue: { gte: rangeStart, lt: rangeEnd },
      responsableActorId: { not: null },
      heureDebut: { not: null },
      heureFin: { not: null },
      initiative: initiativeScope,
    },
  });
  for (const d of deliverables) {
    if (!d.responsableActorId || !d.datePrevue) continue;
    const hours = hoursBetween(d.datePrevue, d.heureDebut, d.heureFin);
    if (!hours) continue;
    const weekStart = isoDate(mondayOf(d.datePrevue));
    entries.push({ actorId: d.responsableActorId, weekStart, hours, source: "livrable", label: d.name });
  }

  return entries;
}

// Agrège en totals[actorId][weekStart] = heures, pour un affichage type heatmap.
export function totalsByActorWeek(entries: ObservedLoadEntry[]): Record<string, Record<string, number>> {
  const totals: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    totals[e.actorId] = totals[e.actorId] || {};
    totals[e.actorId][e.weekStart] = (totals[e.actorId][e.weekStart] || 0) + e.hours;
  }
  return totals;
}
