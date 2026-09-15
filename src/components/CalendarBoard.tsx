"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface CalEvent {
  date: string;
  title: string;
  type: string;
  initiativeId: string;
  initiativeName: string;
  href: string;
  late?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  reunion: "Réunion",
  livrable: "Livrable",
  formation: "Session de formation",
  interface: "Interface",
  action: "Action",
  decision: "Décision attendue",
};

const TABS: { key: string; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "reunion", label: "Réunions" },
  { key: "action", label: "Actions" },
  { key: "livrable", label: "Livrables" },
  { key: "formation", label: "Formations" },
  { key: "interface", label: "Interfaces (MEP)" },
  { key: "decision", label: "Décisions" },
];

const SCALE_OPTIONS: { key: string; label: string; days: number }[] = [
  { key: "semaine", label: "Cette semaine", days: 7 },
  { key: "mois", label: "Ce mois", days: 30 },
  { key: "tout", label: "90 jours", days: 90 },
];

export function CalendarBoard({ events }: { events: CalEvent[] }) {
  const [tab, setTab] = useState("tous");
  const [scale, setScale] = useState("tout");

  const scaleDays = SCALE_OPTIONS.find((s) => s.key === scale)?.days ?? 90;
  const horizon = useMemo(() => Date.now() + scaleDays * 24 * 60 * 60 * 1000, [scaleDays]);
  const withinScale = useMemo(() => events.filter((e) => new Date(e.date).getTime() <= horizon), [events, horizon]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: withinScale.length };
    for (const e of withinScale) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [withinScale]);

  const filtered = tab === "tous" ? withinScale : withinScale.filter((e) => e.type === tab);

  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of filtered) {
      const key = new Date(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {SCALE_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScale(s.key)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              scale === s.key ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50 hover:text-blue"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
            {counts[t.key] ? <span className="ml-1.5 text-xs text-ink/35">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun événement de ce type dans les 90 prochains jours.</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="text-sm font-medium text-ink mb-2 capitalize">{date}</div>
              <div className="space-y-2">
                {items.map((e, i) => (
                  <Link key={i} href={e.href} className="row-link">
                    <div className={`card flex items-center justify-between gap-4 ${e.late ? "bg-bad/5" : ""}`}>
                      <div>
                        <div className="font-medium text-sm">{e.title}</div>
                        <div className="text-xs text-muted">{e.initiativeName}</div>
                      </div>
                      <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5 shrink-0">{TYPE_LABEL[e.type]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
