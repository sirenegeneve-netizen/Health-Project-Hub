import { prisma } from "@/lib/db";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { CalendarBoard, type CalEvent } from "@/components/CalendarBoard";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const scope = await getScope();
  const scopedInitiative = scope.establishmentId ? initiativeScopeWhere(scope) : undefined;

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const inRange = { gte: now, lte: horizon };

  const [meetings, deliverables, sessions, interfaces, actions, decisions] = await Promise.all([
    prisma.meeting.findMany({ where: { date: inRange, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) }, include: { initiative: true }, orderBy: { date: "asc" } }),
    prisma.deliverable.findMany({ where: { datePrevue: inRange, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) }, include: { initiative: true }, orderBy: { datePrevue: "asc" } }),
    prisma.trainingSession.findMany({ where: { date: inRange, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) }, include: { initiative: true }, orderBy: { date: "asc" } }),
    prisma.interface.findMany({ where: { datePrevue: inRange, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) }, include: { initiative: true }, orderBy: { datePrevue: "asc" } }),
    prisma.action.findMany({
      where: { echeance: inRange, status: { notIn: ["termine", "abandonne"] }, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) },
      include: { initiative: true },
      orderBy: { echeance: "asc" },
    }),
    prisma.decision.findMany({
      where: { status: { not: "decision_prise" }, createdAt: { lte: horizon }, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) },
      include: { initiative: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const events: CalEvent[] = [
    ...meetings.map((m) => ({ date: m.date.toISOString(), title: m.title, type: "reunion", initiativeId: m.initiativeId, initiativeName: m.initiative.name, href: `/initiatives/${m.initiativeId}/meetings/${m.id}` })),
    ...deliverables.map((d) => ({ date: d.datePrevue!.toISOString(), title: d.name, type: "livrable", initiativeId: d.initiativeId, initiativeName: d.initiative.name, href: `/initiatives/${d.initiativeId}/conception` })),
    ...sessions.map((s) => ({ date: s.date.toISOString(), title: `Formation (${s.nbInscrits} inscrits)`, type: "formation", initiativeId: s.initiativeId, initiativeName: s.initiative.name, href: `/initiatives/${s.initiativeId}/training` })),
    ...interfaces.map((i) => ({ date: i.datePrevue!.toISOString(), title: `Interface ${i.name}`, type: "interface", initiativeId: i.initiativeId, initiativeName: i.initiative.name, href: `/initiatives/${i.initiativeId}/interfaces` })),
    ...actions.map((a) => ({
      date: a.echeance!.toISOString(),
      title: a.title,
      type: "action",
      initiativeId: a.initiativeId,
      initiativeName: a.initiative.name,
      href: `/initiatives/${a.initiativeId}/actions`,
      late: a.echeance! < now,
    })),
    // Les décisions n'ont pas d'échéance dédiée dans le modèle actuel : on les
    // positionne à leur date de création pour les faire apparaître comme
    // "décisions attendues" tant qu'elles ne sont pas tranchées.
    ...decisions.map((d) => ({ date: d.createdAt.toISOString(), title: d.subject, type: "decision", initiativeId: d.initiativeId, initiativeName: d.initiative.name, href: `/initiatives/${d.initiativeId}/decisions` })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Calendrier</h1>
        <p className="text-sm text-muted">
          Réunions, actions, livrables, formations, interfaces et décisions attendues — 90 prochains jours.
          {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun événement daté dans les 90 prochains jours.</div>
      ) : (
        <CalendarBoard events={events} />
      )}
    </div>
  );
}
