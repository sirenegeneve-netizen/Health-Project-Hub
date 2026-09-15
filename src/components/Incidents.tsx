"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineSelect } from "@/components/InlineSelect";

const GRAVITE_LABELS: Record<string, string> = { mineure: "Mineure", majeure: "Majeure", critique: "Critique" };
const STATUS_OPTIONS = [
  { value: "ouvert", label: "Ouvert" },
  { value: "en_cours", label: "En cours" },
  { value: "resolu", label: "Résolu" },
  { value: "cloture", label: "Clôturé" },
];

interface Incident {
  id: string;
  titre: string;
  description: string | null;
  gravite: string;
  status: string;
  problemId: string | null;
}

export function Incidents({
  initiativeId,
  incidents,
  problems,
}: {
  initiativeId: string;
  incidents: Incident[];
  problems: { id: string; titre: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ titre: "", description: "", gravite: "mineure" });

  async function create() {
    if (!f.titre) return;
    await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, initiativeId }),
    });
    setF({ titre: "", description: "", gravite: "mineure" });
    setOpen(false);
    router.refresh();
  }

  async function linkProblem(incidentId: string, problemId: string) {
    await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problemId || null }),
    });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Incidents</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Déclarer un incident
          </button>
        )}
      </div>

      {incidents.length === 0 ? (
        <p className="text-sm text-ink/40">Aucun incident déclaré.</p>
      ) : (
        <ul className="space-y-2">
          {incidents.map((inc) => (
            <li key={inc.id} className="border-b border-line/60 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{inc.titre}</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${
                      inc.gravite === "critique" ? "bg-bad/10 text-bad" : inc.gravite === "majeure" ? "bg-warn/10 text-warn" : "bg-ink/5 text-ink/60"
                    }`}
                  >
                    {GRAVITE_LABELS[inc.gravite]}
                  </span>
                  <InlineSelect endpoint={`/api/incidents/${inc.id}`} field="status" value={inc.status} options={STATUS_OPTIONS} />
                </div>
              </div>
              {inc.description && <p className="text-xs text-ink/50 mt-1">{inc.description}</p>}
              {problems.length > 0 && (
                <div className="mt-1.5">
                  <select
                    className="text-xs border border-teal-100 rounded px-1.5 py-1 bg-white"
                    value={inc.problemId || ""}
                    onChange={(e) => linkProblem(inc.id, e.target.value)}
                  >
                    <option value="">— Rattacher à un problème —</option>
                    {problems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.titre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <input className="input" placeholder="Titre de l'incident" value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
          <textarea className="input" placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <select className="input" value={f.gravite} onChange={(e) => setF({ ...f, gravite: e.target.value })}>
            {Object.entries(GRAVITE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="btn" onClick={create}>
              Déclarer
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
