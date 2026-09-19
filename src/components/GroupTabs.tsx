"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Vue d'ensemble" },
  { href: "/etablissements", label: "Établissements" },
  { href: "/initiatives", label: "Initiatives" },
  { href: "/gouvernance", label: "Gouvernance" },
  { href: "/risques", label: "Risques" },
  { href: "/actions", label: "Actions" },
  { href: "/documents", label: "Documents" },
  { href: "/relations", label: "Relations" },
  { href: "/reporting", label: "Reporting" },
];

export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;

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
