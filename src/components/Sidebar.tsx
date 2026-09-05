"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV: [string, string, () => JSX.Element][] = [
  ["/", "Portefeuille", IconGrid],
  ["/meetings", "Réunions", IconCalendar],
  ["/actions", "Actions", IconCheck],
  ["/risks", "Risques", IconShield],
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <div className="w-60 shrink-0 bg-teal-900 text-white/90 flex flex-col min-h-screen">
      <div className="px-5 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-base leading-tight text-white">
            Health
            <br />
            Project Hub
          </span>
        </Link>
      </div>

      <form
        className="px-4 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <input
          className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-2 text-sm placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-clay/40"
          placeholder="Rechercher…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(([href, label, Icon]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href as string);
          return (
            <Link
              key={href as string}
              href={href as string}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5">
        <Link href="/projects/new" className="flex items-center gap-2 justify-center rounded-full px-4 py-2 text-sm font-medium bg-clay hover:bg-clay-600 transition-colors">
          + Nouveau projet
        </Link>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden className="shrink-0">
      <rect width="26" height="26" rx="7" fill="#C4623B" />
      <path d="M8 7v12M18 7v12M8 13h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6 } as const;
}

function IconGrid() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M6.5 10l2.3 2.3L14 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...iconProps()}>
      <path d="M10 2l6 2.5v4.8c0 4.1-2.6 7.1-6 8.2-3.4-1.1-6-4.1-6-8.2V4.5L10 2z" strokeLinejoin="round" />
    </svg>
  );
}
