"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HealthBadge } from "@/components/HealthBadge";
import { Pill } from "@/components/Pill";
import type { HealthLevel } from "@/lib/healthScore";

export interface ExplorerProject {
  id: string;
  name: string;
  reference: string;
  type: string;
  typeLabel: string;
  status: string; // actif | en_pause | cloture
  priority: string;
  chefDeProjet: string | null;
  targetDate: string | null;
  establishments: string[];
  healthLevel: HealthLevel;
  healthLabel: string;
  progress: number | null;
  stageLabel: string;
}

type TabKey = "tous" | "mes_projets" | "actifs" | "a_risque" | "termines";

const TABS: { key: TabKey; label: string }[] = [
  { key: "tous", label: "Tous les projets" },
  { key: "actifs", label: "Actifs" },
  { key: "a_risque", label: "À risque" },
  { key: "termines", label: "Terminés" },
  { key: "mes_projets", label: "Mes projets" },
];

const PRIORITY_LABELS: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  critique: "Critique",
};

export function ProjectsExplorer({ projects }: { projects: ExplorerProject[] }) {
  const [tab, setTab] = useState<TabKey>("tous");
  const [query, setQuery] = useState("");
  const [establishment, setEstablishment] = useState("tous");
  const [type, setType] = useState("tous");
  const [nom, setNom] = useState("");

  const establishments = useMemo(
    () => Array.from(new Set(projects.flatMap((p) => p.establishments))).sort(),
    [projects]
  );
  const types = useMemo(() => Array.from(new Set(projects.map((p) => p.type))), [projects]);

  const counts = useMemo(
    () => ({
      tous: projects.length,
      actifs: projects.filter((p) => p.status === "actif").length,
      a_risque: projects.filter((p) => p.healthLevel === "rouge").length,
      termines: projects.filter((p) => p.status === "cloture").length,
      mes_projets: nom.trim()
        ? projects.filter((p) => (p.chefDeProjet || "").toLowerCase().includes(nom.trim().toLowerCase())).length
        : null,
    }),
    [projects, nom]
  );

  const filtered = projects
    .filter((p) => {
      if (tab === "actifs" && p.status !== "actif") return false;
      if (tab === "a_risque" && p.healthLevel !== "rouge") return false;
      if (tab === "termines" && p.status !== "cloture") return false;
      if (tab === "mes_projets" && !(nom.trim() && (p.chefDeProjet || "").toLowerCase().includes(nom.trim().toLowerCase()))) return false;
      if (query && !`${p.name} ${p.reference} ${p.chefDeProjet || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (establishment !== "tous" && !p.establishments.includes(establishment)) return false;
      if (type !== "tous" && p.type !== type) return false;
      return true;
    })
    .sort((a, b) => (a.targetDate ? new Date(a.targetDate).getTime() : Infinity) - (b.targetDate ? new Date(b.targetDate).getTime() : Infinity));

  return (
    <div>
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
            {counts[t.key] !== null && <span className="ml-1.5 text-xs text-ink/35">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === "mes_projets" && (
        <div className="mb-4">
          <input
            className="input max-w-xs"
            placeholder="Votre nom tel qu'il apparaît comme chef de projet…"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="input max-w-xs"
          placeholder="Rechercher un projet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-auto" value={establishment} onChange={(e) => setEstablishment(e.target.value)}>
          <option value="tous">Tous les établissements</option>
          {establishments.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="tous">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {projects.find((p) => p.type === t)?.typeLabel || t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun projet ne correspond à ces filtres.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-line">
                <th className="px-4 py-3 font-medium">Projet</th>
                <th className="px-4 py-3 font-medium">Établissement</th>
                <th className="px-4 py-3 font-medium">Chef de projet</th>
                <th className="px-4 py-3 font-medium">Étape</th>
                <th className="px-4 py-3 font-medium">Avancement</th>
                <th className="px-4 py-3 font-medium">Priorité</th>
                <th className="px-4 py-3 font-medium">Échéance</th>
                <th className="px-4 py-3 font-medium">Santé</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/60">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:text-primary">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink/40">{p.reference} · {p.typeLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{p.establishments.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{p.chefDeProjet || "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{p.stageLabel}</td>
                  <td className="px-4 py-3 text-ink/70">{p.progress !== null ? `${p.progress} %` : "—"}</td>
                  <td className="px-4 py-3">
                    <Pill text={PRIORITY_LABELS[p.priority] || p.priority} tone={p.priority === "critique" ? "bad" : p.priority === "haute" ? "warn" : "neutral"} />
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {p.targetDate ? new Date(p.targetDate).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge level={p.healthLevel} label={p.healthLabel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
