"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation à 2 niveaux : quelques boutons génériques (Vue d'ensemble, Cadrage,
// Parcours, Suivi), chacun regroupant les écrans qui répondent à une même
// question métier. Le groupe "Parcours" est le seul dont le contenu varie selon
// le type d'initiative (voir InitiativeTabsServer) — Cadrage et Suivi sont
// identiques pour tous les types.
export interface SubTab {
  href: string;
  label: string;
  match: string[];
}

interface Group {
  key: string;
  label: string;
  href?: string; // groupe sans sous-onglets (navigation directe)
  children?: SubTab[];
}

const CADRAGE_CHILDREN: SubTab[] = [
  { href: "/cadrage", label: "Général", match: ["/cadrage", "/stakeholders", "/budget"] },
  { href: "/etablissements", label: "Établissements", match: ["/etablissements"] },
  { href: "/actors", label: "Gouvernance & RACI", match: ["/actors"] },
];

const SUIVI_CHILDREN: SubTab[] = [
  { href: "/relations", label: "Relations", match: ["/relations"] },
  { href: "/timeline", label: "Mémoire", match: ["/timeline"] },
];

export function InitiativeTabsClient({ initiativeId, parcoursChildren }: { initiativeId: string; parcoursChildren: SubTab[] }) {
  const pathname = usePathname();
  const base = `/initiatives/${initiativeId}`;

  const groups: Group[] = [
    { key: "overview", label: "Vue d'ensemble", href: "" },
    { key: "cadrage", label: "Cadrage", children: CADRAGE_CHILDREN },
    { key: "parcours", label: "Parcours", children: parcoursChildren },
    { key: "suivi", label: "Suivi", children: SUIVI_CHILDREN },
  ];

  const activeGroup = groups.find((g) =>
    g.children ? g.children.some((c) => c.match.some((m) => pathname === `${base}${m}`)) : pathname === `${base}${g.href}`
  );

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-1 -mx-1">
        {groups.map((g) => {
          const isActive = activeGroup?.key === g.key;
          const href = g.children ? `${base}${g.children[0].href}` : `${base}${g.href}`;
          return (
            <Link
              key={g.key}
              href={href}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                isActive ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50 hover:text-blue"
              }`}
            >
              {g.label}
            </Link>
          );
        })}
      </div>

      {activeGroup?.children && (
        <div className="flex flex-wrap gap-1 -mx-1 mt-2 pl-1">
          {activeGroup.children.map((c, i) => {
            const active = c.match.some((m) => pathname === `${base}${m}`);
            return (
              <Link
                key={`${c.href}-${i}`}
                href={`${base}${c.href}`}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  active ? "bg-teal-100 text-primary font-medium" : "text-ink/45 hover:bg-teal-50 hover:text-blue"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
