"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Vue d'ensemble"],
  ["/planning", "Planning"],
  ["/budget", "Budget"],
  ["/risks", "Risques"],
  ["/actions", "Actions"],
  ["/deliverables", "Livrables"],
  ["/stakeholders", "Parties prenantes"],
  ["/kpis", "Indicateurs"],
  ["/meetings", "Réunions"],
  ["/decisions", "Décisions"],
  ["/interfaces", "Interfaces"],
  ["/training", "Formation"],
  ["/golive", "Go/No Go"],
  ["/timeline", "Mémoire"],
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <div className="flex flex-wrap gap-1 mb-8 -mx-1">
      {TABS.map(([suffix, label]) => {
        const href = `${base}${suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              active ? "bg-teal-700 text-white" : "text-ink/60 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
