"use client";

import Link from "next/link";
import { useState } from "react";

export function RoadmapRow({
  id,
  name,
  left,
  width,
  healthColorClass,
  healthLabel,
  milestones,
}: {
  id: string;
  name: string;
  left: number;
  width: number;
  healthColorClass: string;
  healthLabel: string;
  milestones: { id: string; name: string; pct: number | null; dateLabel: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-56 shrink-0 pr-3 flex items-center gap-1.5 text-sm text-ink hover:text-blue truncate text-left"
        >
          <span className={`inline-block text-[10px] text-muted transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="truncate">{name}</span>
        </button>
        <div className="relative h-7 flex-1 bg-ink/[0.03] rounded">
          <div
            className={`absolute top-1 bottom-1 rounded ${healthColorClass} opacity-80`}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${name} — ${healthLabel}`}
          />
          {milestones.map((m) =>
            m.pct === null ? null : (
              <span
                key={m.id}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-ink/70 text-xs leading-none"
                style={{ left: `${m.pct}%` }}
                title={`Jalon : ${m.name} — ${m.dateLabel}`}
              >
                ◆
              </span>
            )
          )}
        </div>
      </div>

      {open && (
        <div className="ml-56 pl-3 py-2 border-l-2 border-line/70">
          <Link href={`/initiatives/${id}`} className="text-xs text-blue hover:underline">
            Ouvrir l'initiative →
          </Link>
          {milestones.length === 0 ? (
            <p className="text-xs text-muted mt-1">Aucun jalon daté.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {milestones.map((m) => (
                <li key={m.id} className="text-xs text-ink/70">
                  <span className="text-ink/40 mr-1">◆</span>
                  {m.name} — <span className="text-muted">{m.dateLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
