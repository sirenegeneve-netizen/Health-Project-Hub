"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";

const CYCLE = ["non_commence", "en_cours", "bloque", "pret"] as const;

const TONE: Record<string, "neutral" | "ok" | "warn" | "bad"> = {
  non_commence: "neutral",
  en_cours: "warn",
  bloque: "bad",
  pret: "ok",
};

const TEXT: Record<string, string> = {
  non_commence: "Non commencé",
  en_cours: "En cours",
  bloque: "Bloqué",
  pret: "Prêt",
};

interface Criterion {
  id: string;
  label: string;
  status: string;
}

// Checklist cliquable : chaque clic fait cycler le statut, exactement comme la
// matrice RACI (src/components/RaciBoard.tsx) — une seule interaction à
// apprendre dans toute l'application.
export function StageCriteriaList({ criteria }: { criteria: Criterion[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function cycle(id: string, current: string) {
    const idx = CYCLE.indexOf(current as (typeof CYCLE)[number]);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setPending(id);
    await fetch(`/api/stage-criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(null);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-ink/5">
      {criteria.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-sm text-body">{c.label}</span>
          <button
            onClick={() => cycle(c.id, c.status)}
            disabled={pending === c.id}
            className="shrink-0 disabled:opacity-50"
            title="Cliquer pour changer le statut"
          >
            <Pill text={TEXT[c.status] || c.status} tone={TONE[c.status] || "neutral"} />
          </button>
        </li>
      ))}
    </ul>
  );
}
