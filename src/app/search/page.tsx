"use client";

import { useState } from "react";
import Link from "next/link";

interface Result {
  kind: string;
  label: string;
  href: string;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSearch(value: string) {
    setQ(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
    const data = await res.json();
    setResults(data.results);
    setLoading(false);
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-teal-700 mb-4">Recherche globale</h1>
      <input
        autoFocus
        className="input mb-6"
        placeholder="Rechercher un projet, une action, une interface, un mail…"
        value={q}
        onChange={(e) => runSearch(e.target.value)}
      />

      {loading && <div className="text-ink/50 text-sm">Recherche…</div>}

      <div className="space-y-2">
        {results.map((r, i) => (
          <Link key={i} href={r.href} className="card flex items-center justify-between hover:bg-teal-50/30 block">
            <span>{r.label}</span>
            <span className="text-xs text-ink/50 uppercase tracking-wide">{r.kind}</span>
          </Link>
        ))}
        {q && !loading && results.length === 0 && <div className="card text-center text-ink/50">Aucun résultat pour « {q} ».</div>}
      </div>
    </div>
  );
}
