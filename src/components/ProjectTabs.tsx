"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Cockpit"],
  ["/meetings", "Réunions"],
  ["/actions", "Actions"],
  ["/risks", "Risques"],
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
    <div className="flex flex-wrap gap-1 border-b border-teal-100 mb-6">
      {TABS.map(([suffix, label]) => {
        const href = `${base}${suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px ${
              active ? "border-teal-600 text-teal-700 font-medium" : "border-transparent text-ink/60 hover:text-teal-600"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
