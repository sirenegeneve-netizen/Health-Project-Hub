"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation organisée par étape du cycle de vie du projet plutôt que par module
// technique — chaque onglet regroupe les écrans qui répondent à une même question
// métier. Les routes historiques (ex. /actions, /budget) restent accessibles en
// lien profond depuis la page de regroupement ; elles gardent leur onglet parent
// actif via `match`.
const TABS: { href: string; label: string; match: string[] }[] = [
  { href: "", label: "Vue d'ensemble", match: [""] },
  { href: "/cadrage", label: "Cadrage", match: ["/cadrage", "/stakeholders", "/actors", "/budget"] },
  { href: "/conception", label: "Conception", match: ["/conception", "/deliverables", "/changes"] },
  { href: "/interfaces", label: "Interopérabilité", match: ["/interfaces"] },
  { href: "/realisation", label: "Réalisation", match: ["/realisation", "/actions", "/planning", "/decisions", "/meetings"] },
  { href: "/validation", label: "Validation", match: ["/validation"] },
  { href: "/training", label: "Accompagnement", match: ["/training"] },
  { href: "/golive", label: "Déploiement", match: ["/golive"] },
  { href: "/run", label: "Run & Évolutions", match: ["/run", "/kpis"] },
  { href: "/timeline", label: "Mémoire", match: ["/timeline"] },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <div className="flex flex-wrap gap-1 mb-8 -mx-1">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.match.some((m) => pathname === `${base}${m}`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              active ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50 hover:text-blue"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
