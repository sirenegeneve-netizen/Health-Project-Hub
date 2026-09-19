"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Vue d'ensemble" },
  { href: "/cadrage", label: "Cadrage" },
  { href: "/gouvernance", label: "Gouvernance" },
  { href: "/si", label: "SI & périmètre" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/risques", label: "Risques" },
  { href: "/actions", label: "Actions" },
  { href: "/documents", label: "Documents" },
];

export function EstablishmentTabs({ establishmentId }: { establishmentId: string }) {
  const pathname = usePathname();
  const base = `/establishments/${establishmentId}`;

  return (
    <div className="flex flex-wrap gap-1 -mx-1 mb-6">
      {TABS.map((t) => {
        const active = pathname === `${base}${t.href}`;
        return (
          <Link
            key={t.href || "overview"}
            href={`${base}${t.href}`}
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
