interface GanttTask {
  id: string;
  title: string;
  dateDebut: string | null;
  echeance: string | null;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  a_faire: "bg-ink/20",
  en_cours: "bg-primary",
  en_attente: "bg-warn",
  termine: "bg-ok",
  abandonne: "bg-ink/10",
};

export function GanttChart({ tasks }: { tasks: GanttTask[] }) {
  const dated = tasks.filter((t) => t.dateDebut || t.echeance);
  if (dated.length === 0) return null;

  const starts = dated.map((t) => new Date(t.dateDebut || t.echeance!).getTime());
  const ends = dated.map((t) => new Date(t.echeance || t.dateDebut!).getTime());
  const rangeStartRaw = Math.min(...starts);
  const rangeEndRaw = Math.max(...ends);
  // Petite marge de part et d'autre pour ne pas coller les barres aux bords.
  const pad = Math.max((rangeEndRaw - rangeStartRaw) * 0.04, 1000 * 60 * 60 * 24);
  const rangeStart = rangeStartRaw - pad;
  const rangeEnd = rangeEndRaw + pad;
  const span = rangeEnd - rangeStart;

  const now = Date.now();
  const todayPct = now >= rangeStart && now <= rangeEnd ? ((now - rangeStart) / span) * 100 : null;

  // Repères mensuels sur l'axe du haut.
  const months: { label: string; pct: number }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  while (cursor.getTime() <= rangeEnd) {
    const pct = ((cursor.getTime() - rangeStart) / span) * 100;
    if (pct >= 0 && pct <= 100) {
      months.push({ label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), pct });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative h-6 mb-2 ml-48">
          {months.map((m, i) => (
            <span key={i} className="absolute text-xs text-muted -translate-x-1/2" style={{ left: `${m.pct}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="relative">
          {todayPct !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-bad/40 ml-48" style={{ left: `${todayPct}%` }} />
          )}
          <div className="space-y-2">
            {dated.map((t) => {
              const start = new Date(t.dateDebut || t.echeance!).getTime();
              const end = new Date(t.echeance || t.dateDebut!).getTime();
              const left = ((start - rangeStart) / span) * 100;
              const width = Math.max(((end - start) / span) * 100, 0.8);
              return (
                <div key={t.id} className="flex items-center">
                  <div className="w-48 shrink-0 pr-3 text-sm truncate" title={t.title}>
                    {t.title}
                  </div>
                  <div className="relative h-6 flex-1 bg-ink/[0.03] rounded">
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded ${STATUS_COLOR[t.status] || "bg-ink/20"}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={t.title}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
