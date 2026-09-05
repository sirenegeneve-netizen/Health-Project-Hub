"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HealthBadge, HealthBar } from "@/components/HealthBadge";
import { Pill } from "@/components/Pill";
import type { HealthLevel } from "@/lib/healthScore";

export interface PortfolioProject {
  id: string;
  name: string;
  reference: string;
  phase: string;
  status: string;
  priority: string;
  targetDate: string | null;
  establishments: string[];
  healthLevel: HealthLevel;
  healthLabel: string;
}

export function PortfolioList({ projects }: { projects: PortfolioProject[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("tous");
  const [health, setHealth] = useState("tous");

  const statuses = useMemo(() => Array.from(new Set(projects.map((p) => p.status))), [projects]);

  const filtered = projects.filter((p) => {
    if (query && !`${p.name} ${p.reference}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (status !== "tous" && p.status !== status) return false;
    if (health !== "tous" && p.healthLevel !== health) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Rechercher un projet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="tous">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={health} onChange={(e) => setHealth(e.target.value)}>
          <option value="tous">Tous niveaux</option>
          <option value="vert">Maîtrisé</option>
          <option value="orange">À surveiller</option>
          <option value="rouge">À risque</option>
        </select>
      </div>

      <div className="space-y-2.5">
        {filtered.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="row-link">
            <div className="relative overflow-hidden card flex items-center justify-between gap-6 pl-6">
              <HealthBar level={p.healthLevel} />
              <div className="min-w-0">
                <div className="font-display text-lg text-ink truncate">{p.name}</div>
                <div className="text-xs text-ink/45 mt-0.5">
                  {p.reference} · {p.establishments.join(", ") || "établissement non défini"}
                </div>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <Pill text={p.phase.replace(/_/g, " ")} />
                <span className="text-sm text-ink/60 hidden sm:inline">
                  {p.targetDate ? new Date(p.targetDate).toLocaleDateString("fr-FR") : "—"}
                </span>
                <HealthBadge level={p.healthLevel} label={p.healthLabel} />
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <div className="card text-center text-ink/50 py-10">Aucun projet ne correspond à ces filtres.</div>}
      </div>
    </div>
  );
}
