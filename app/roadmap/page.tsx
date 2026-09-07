import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";

export const dynamic = "force-dynamic";

const HEALTH_COLOR: Record<string, string> = { vert: "bg-ok", orange: "bg-warn", rouge: "bg-bad" };

export default async function RoadmapPage() {
  const projects = await prisma.project.findMany({
    where: { status: { not: "cloture" } },
    include: { establishments: { include: { establishment: true } } },
    orderBy: { startDate: "asc" },
  });

  const dated = projects.filter((p) => p.startDate || p.targetDate);

  if (dated.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Roadmap portefeuille</h1>
        <div className="card text-center text-ink/50 py-14">
          Aucun projet avec une date de début ou une date cible pour construire la roadmap.
        </div>
      </div>
    );
  }

  const scores = await Promise.all(dated.map((p) => computeHealthScore(p.id)));

  const starts = dated.map((p) => (p.startDate || p.createdAt).getTime());
  const ends = dated.map((p) => (p.targetDate || p.startDate || p.createdAt).getTime());
  const rangeStartRaw = Math.min(...starts);
  const rangeEndRaw = Math.max(...ends, Date.now());
  const pad = Math.max((rangeEndRaw - rangeStartRaw) * 0.03, 1000 * 60 * 60 * 24 * 7);
  const rangeStart = rangeStartRaw - pad;
  const rangeEnd = rangeEndRaw + pad;
  const span = rangeEnd - rangeStart;

  const now = Date.now();
  const todayPct = now >= rangeStart && now <= rangeEnd ? ((now - rangeStart) / span) * 100 : null;

  const quarters: { label: string; pct: number }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
  while (cursor.getTime() <= rangeEnd) {
    const pct = ((cursor.getTime() - rangeStart) / span) * 100;
    if (pct >= 0 && pct <= 100) {
      const q = Math.floor(cursor.getMonth() / 3) + 1;
      quarters.push({ label: `T${q} ${cursor.getFullYear()}`, pct });
    }
    cursor.setMonth(cursor.getMonth() + 3);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Roadmap portefeuille</h1>
        <p className="text-sm text-muted">Tous les projets actifs sur une même ligne temporelle — chevauchements et périodes critiques en un coup d'œil.</p>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="relative h-6 mb-2 ml-56">
            {quarters.map((q, i) => (
              <span key={i} className="absolute text-xs text-muted border-l border-line pl-1.5 -translate-x-px" style={{ left: `${q.pct}%` }}>
                {q.label}
              </span>
            ))}
          </div>
          <div className="relative space-y-2">
            {todayPct !== null && <div className="absolute top-0 bottom-0 w-px bg-bad/40 ml-56 z-10" style={{ left: `${todayPct}%` }} />}
            {dated.map((p, i) => {
              const start = (p.startDate || p.createdAt).getTime();
              const end = (p.targetDate || p.startDate || p.createdAt).getTime();
              const left = ((start - rangeStart) / span) * 100;
              const width = Math.max(((end - start) / span) * 100, 0.6);
              return (
                <div key={p.id} className="flex items-center">
                  <Link href={`/projects/${p.id}`} className="w-56 shrink-0 pr-3 text-sm text-ink hover:text-blue truncate">
                    {p.name}
                  </Link>
                  <div className="relative h-7 flex-1 bg-ink/[0.03] rounded">
                    <div
                      className={`absolute top-1 bottom-1 rounded ${HEALTH_COLOR[scores[i].level]} opacity-80`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${p.name} — ${scores[i].label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-3 text-xs text-muted">
        <span><span className="inline-block w-3 h-3 rounded bg-ok align-middle mr-1" />Maîtrisé</span>
        <span><span className="inline-block w-3 h-3 rounded bg-warn align-middle mr-1" />À surveiller</span>
        <span><span className="inline-block w-3 h-3 rounded bg-bad align-middle mr-1" />À risque</span>
        <span><span className="inline-block w-px h-3 bg-bad/40 align-middle mr-1" />Aujourd'hui</span>
      </div>

      {projects.length > dated.length && (
        <p className="text-xs text-muted/70 mt-4">
          {projects.length - dated.length} projet(s) actif(s) sans date de début ni date cible ne sont pas représentés.
        </p>
      )}
    </div>
  );
}
