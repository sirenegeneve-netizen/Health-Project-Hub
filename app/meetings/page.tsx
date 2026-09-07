import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GlobalMeetingsPage() {
  const meetings = await prisma.meeting.findMany({ include: { project: true }, orderBy: { date: "desc" } });

  if (meetings.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Réunions</h1>
        <div className="card text-center text-ink/50 py-14">Aucune réunion planifiée pour l'instant.</div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = meetings.filter((m) => m.date >= now).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = meetings.filter((m) => m.date < now);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-6">Réunions</h1>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <div className="font-medium text-sm mb-2">À venir</div>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <Link key={m.id} href={`/projects/${m.projectId}/meetings/${m.id}`} className="row-link">
                <div className="card flex items-center justify-between">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-ink/50">{m.project.name}</div>
                  </div>
                  <span className="text-sm text-ink/60">{new Date(m.date).toLocaleString("fr-FR")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="font-medium text-sm mb-2">Passées</div>
          <div className="space-y-2">
            {past.slice(0, 15).map((m) => (
              <Link key={m.id} href={`/projects/${m.projectId}/meetings/${m.id}`} className="row-link">
                <div className="card flex items-center justify-between opacity-80">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-ink/50">{m.project.name}</div>
                  </div>
                  <span className="text-sm text-ink/50">{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
