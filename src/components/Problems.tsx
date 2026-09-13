"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineSelect } from "@/components/InlineSelect";

const STATUS_OPTIONS = [
  { value: "investigation", label: "Investigation" },
  { value: "cause_identifiee", label: "Cause identifiée" },
  { value: "solution_en_cours", label: "Solution en cours" },
  { value: "resolu", label: "Résolu" },
];

interface Problem {
  id: string;
  titre: string;
  causeRacine: string | null;
  status: string;
  incidents: { id: string; titre: string }[];
}

export function Problems({ initiativeId, problems }: { initiativeId: string; problems: Problem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ titre: "", causeRacine: "" });

  async function create() {
    if (!f.titre) return;
    await fetch("/api/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, initiativeId }),
    });
    setF({ titre: "", causeRacine: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Problèmes</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Ouvrir un problème
          </button>
        )}
      </div>

      {problems.length === 0 ? (
        <p className="text-sm text-ink/40">Aucun problème ouvert.</p>
      ) : (
        <ul className="space-y-2">
          {problems.map((p) => (
            <li key={p.id} className="border-b border-line/60 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{p.titre}</div>
                <InlineSelect endpoint={`/api/problems/${p.id}`} field="status" value={p.status} options={STATUS_OPTIONS} />
              </div>
              {p.causeRacine && <p className="text-xs text-ink/50 mt-1">Cause racine : {p.causeRacine}</p>}
              {p.incidents.length > 0 && (
                <p className="text-xs text-ink/40 mt-1">{p.incidents.length} incident(s) rattaché(s) : {p.incidents.map((i) => i.titre).join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <input className="input" placeholder="Titre du problème" value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
          <textarea className="input" placeholder="Cause racine (si connue)" value={f.causeRacine} onChange={(e) => setF({ ...f, causeRacine: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn" onClick={create}>
              Ouvrir
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
