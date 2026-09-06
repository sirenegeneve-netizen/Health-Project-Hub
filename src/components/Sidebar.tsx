"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, CalendarDays, CheckSquare, ShieldAlert, Search, Plus } from "lucide-react";

const NAV = [
  { href: "/", label: "Portefeuille", Icon: LayoutGrid },
  { href: "/meetings", label: "Réunions", Icon: CalendarDays },
  { href: "/actions", label: "Actions", Icon: CheckSquare },
  { href: "/risks", label: "Risques", Icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <div
      className="w-64 shrink-0 text-white/90 flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #061B3A 0%, #082A4E 100%)" }}
    >
      <div className="px-5 py-6 relative z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display font-semibold text-base leading-tight text-white">
            Health
            <br />
            Project Hub
          </span>
        </Link>
      </div>

      <form
        className="px-4 mb-4 relative z-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
          <input
            className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </form>

      <nav className="flex-1 px-3 space-y-0.5 relative z-10">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 pl-3 pr-3 py-2 text-sm transition-colors border-l-4 ${
                active
                  ? "border-primary text-white font-medium"
                  : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
              }`}
              style={active ? { backgroundColor: "rgba(14,165,168,0.15)" } : undefined}
            >
              <Icon size={17} className={active ? "text-primary" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-6 relative z-10">
        <Link href="/projects/new" className="flex items-center gap-2 justify-center rounded-lg px-4 py-2.5 text-sm font-medium bg-primary hover:bg-primary-600 transition-colors">
          <Plus size={16} />
          Nouveau projet
        </Link>
      </div>

      {/* Ondes discrètes — évoque flux de données / interopérabilité, jamais au-dessus de la nav */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 -right-16 h-64 opacity-50 blur-3xl z-0"
        style={{
          background:
            "radial-gradient(closest-side, rgba(20,184,187,0.45), transparent), radial-gradient(closest-side at 75% 25%, rgba(124,58,237,0.35), transparent)",
        }}
      />
    </div>
  );
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden className="shrink-0">
      <rect width="26" height="26" rx="7" fill="#0EA5A8" />
      <path d="M8 7v12M18 7v12M8 13h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
