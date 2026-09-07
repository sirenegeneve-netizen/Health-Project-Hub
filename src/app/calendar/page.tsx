import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CalEvent {
  date: Date;
  title: string;
  type: string;
  projectId: string;
  projectName: string;
  href: string;
}

const TYPE_LABEL: Record<string, string> = {
  reunion: "Réunion",
  livrable: "Livrable",
  formation: "Session de formation",
  interface: "Interface",
};

export default async function CalendarPage() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [meetings, deliverables, sessions, interfaces] = await Promise.all([
    prisma.meeting.findMany({ where: { date: { gte: now, lte: horizon } }, include: { project: true }, orderBy: { date: "asc" } }),
    prisma.deliverable.findMany({ where: { datePrevue: { gte: now, lte: horizon } }, include: { project: true }, orderBy: { datePrevue: "asc" } }),
    prisma.trainingSession.findMany({ where: { date: { gte: now, lte: horizon } }, include: { project: true }, orderBy: { date: "asc" } }),
    prisma.interface.findMany({ where: { datePrevue: { gte: now, lte: horizon } }, include: { project: true }, orderBy: { datePrevue: "asc" } }),
  ]);

  const events: CalEvent[] = [
    ...meetings.map((m) => ({ date: m.date, title: m.title, type: "reunion", projectId: m.projectId, projectName: m.project.name, href: `/projects/${m.projectId}/meetings/${m.id}` })),
    ...deliverables.map((d) => ({ date: d.datePrevue!, title: d.name, type: "livrable", projectId: d.projectId, projectName: d.project.name, href: `/projects/${d.projectId}/conception` })),
    ...sessions.map((s) => ({ date: s.date, title: `Formation (${s.nbInscrits} inscrits)`, type: "formation", projectId: s.projectId, projectName: s.project.name, href: `/projects/${s.projectId}/training` })),
    ...interfaces.map((i) => ({ date: i.datePrevue!, title: `Interface ${i.name}`, type: "interface", projectId: i.projectId, projectName: i.project.name, href: `/projects/${i.projectId}/interfaces` })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (events.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Calendrier</h1>
        <div className="card text-center text-ink/50 py-14">Aucun événement daté dans les 90 prochains jours.</div>
      </div>
    );
  }

  const grouped = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = e.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Calendrier</h1>
        <p className="text-sm text-muted">Réunions, livrables, formations et interfaces à venir sur tous les projets — 90 prochains jours.</p>
      </div>

      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([date, items]) => (
          <div key={date}>
            <div className="text-sm font-medium text-ink mb-2 capitalize">{date}</div>
            <div className="space-y-2">
              {items.map((e, i) => (
                <Link key={i} href={e.href} className="row-link">
                  <div className="card flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-sm">{e.title}</div>
                      <div className="text-xs text-muted">{e.projectName}</div>
                    </div>
                    <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5 shrink-0">{TYPE_LABEL[e.type]}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
