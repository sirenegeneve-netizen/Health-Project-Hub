"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Barre partagée par les pages transversales de HPH (Portefeuille, Initiatives,
// Roadmap/Calendrier, Risques, Reporting, Interactions). Elle ne remplace pas
// la sidebar ni ces pages — elle signale qu'elles font partie d'un même
// cockpit et permet de passer de l'une à l'autre sans repasser par le menu.
const TABS = [
  { href: "/", label: "Vue globale", match: ["/"] },
  { href: "/initiatives", label: "Initiatives", match: ["/initiatives"] },
  { href: "/roadmap", label: "Planning", match: ["/roadmap", "/calendar"] },
  { href: "/risks", label: "Risques & alertes", match: ["/risks"] },
  { href: "/portfolio/relations", label: "Interactions & dépendances", match: ["/portfolio/relations"] },
  { href: "/reports", label: "Indicateurs", match: ["/reports"] },
  { href: "/journal", label: "Journal d'activité", match: ["/journal"] },
];

export function PortfolioTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 -mx-1 mb-6">
      {TABS.map((t) => {
        const active = t.match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              active ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50 hover:text-blue"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
