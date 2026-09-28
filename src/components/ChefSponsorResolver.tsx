"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Row {
  initiativeId: string;
  initiativeName: string;
  field: "chefDeProjetId" | "sponsorId";
  fieldLabel: string;
  valeurTexte: string;
  candidates: { id: string; name: string }[];
}

export function ChefSponsorResolver({ rows, allActors }: { rows: Row[]; allActors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  function key(r: Row) {
    return `${r.initiativeId}:${r.field}`;
  }

  async function attach(r: Row, actorId: string) {
    const k = key(r);
    setBusyKey(k);
    try {
      await fetch(`/api/initiatives/${r.initiativeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [r.field]: actorId }),
      });
      setResolved((s) => new Set(s).add(k));
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function createAndAttach(r: Row) {
    const k = key(r);
    setBusyKey(k);
    try {
      const res = await fetch("/api/actors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiativeId: r.initiativeId, name: r.valeurTexte.trim() }),
      });
      const actor = await res.json();
      await attach(r, actor.id);
    } finally {
      setBusyKey(null);
    }
  }

  const pending = rows.filter((r) => !resolved.has(key(r)));

  return (
    <div>
      <p className="text-sm text-ink/50 mb-4">
        {pending.length} cas restant{pending.length > 1 ? "s" : ""} sur {rows.length}.
      </p>
      <div className="space-y-3">
        {rows.map((r) => {
          const k = key(r);
          const isResolved = resolved.has(k);
          const isBusy = busyKey === k;
          return (
            <div key={k} className={`card ${isResolved ? "opacity-40" : ""}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <Link href={`/initiatives/${r.initiativeId}`} className="text-sm font-medium text-blue hover:underline">
                    {r.initiativeName}
                  </Link>
                  <div className="text-sm text-ink/70 mt-0.5">
                    {r.fieldLabel} saisi : <span className="font-medium">« {r.valeurTexte} »</span>
                  </div>
                </div>
                {isResolved && <span className="text-xs text-good font-medium">Rattaché ✓</span>}
              </div>

              {!isResolved && (
                <div className="mt-3 space-y-2">
                  {r.candidates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-ink/40 self-center">Candidat{r.candidates.length > 1 ? "s" : ""} probable{r.candidates.length > 1 ? "s" : ""} :</span>
                      {r.candidates.map((c) => (
                        <button key={c.id} className="btn-secondary text-xs" disabled={isBusy} onClick={() => attach(r, c.id)}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      className="input text-sm"
                      value={picked[k] || ""}
                      onChange={(e) => setPicked({ ...picked, [k]: e.target.value })}
                    >
                      <option value="">Rattacher à un autre acteur existant...</option>
                      {allActors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn-secondary text-xs" disabled={isBusy || !picked[k]} onClick={() => attach(r, picked[k])}>
                      Rattacher
                    </button>
                    <span className="text-xs text-ink/30">ou</span>
                    <button className="btn text-xs" disabled={isBusy} onClick={() => createAndAttach(r)}>
                      Créer l'acteur « {r.valeurTexte.trim()} » et rattacher
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
