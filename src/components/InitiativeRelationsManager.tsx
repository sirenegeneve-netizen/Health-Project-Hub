"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["depend_de", "Dépend de"],
  ["prerequis_pour", "Prérequis pour"],
  ["impacte", "Impacte"],
  ["lie_a", "Liée à"],
  ["conflit_avec", "En conflit avec"],
  ["ressource_partagee_avec", "Ressource partagée avec"],
];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES);

interface RelationRow {
  id: string;
  type: string;
  note: string | null;
  auto: boolean;
  direction: "source" | "cible";
  other: { id: string; name: string };
}

export function InitiativeRelationsManager({
  initiativeId,
  relations,
  otherInitiatives,
}: {
  initiativeId: string;
  relations: RelationRow[];
  otherInitiatives: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ cibleId: "", type: "depend_de", note: "" });

  async function create() {
    if (!f.cibleId) return;
    await fetch("/api/initiative-relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initiativeSourceId: initiativeId,
        initiativeCibleId: f.cibleId,
        type: f.type,
        note: f.note || null,
      }),
    });
    setF({ cibleId: "", type: "depend_de", note: "" });
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/initiative-relations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const manual = relations.filter((r) => !r.auto);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Relations déclarées</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Ajouter une relation
          </button>
        )}
      </div>

      {manual.length === 0 ? (
        <p className="text-sm text-ink/40">Aucune relation déclarée avec une autre initiative.</p>
      ) : (
        <ul className="space-y-1.5">
          {manual.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
              <div>
                <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5 mr-2">
                  {r.direction === "source" ? TYPE_LABELS[r.type] : `← ${TYPE_LABELS[r.type]}`}
                </span>
                <Link href={`/initiatives/${r.other.id}`} className="text-blue hover:underline font-medium">
                  {r.other.name}
                </Link>
                {r.note && <span className="text-ink/50"> — {r.note}</span>}
              </div>
              <button className="text-xs text-red-500 hover:underline" onClick={() => remove(r.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={f.cibleId} onChange={(e) => setF({ ...f, cibleId: e.target.value })}>
              <option value="">— Choisir une initiative —</option>
              {otherInitiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <input className="input" placeholder="Note (optionnel)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn" onClick={create}>
              Ajouter
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
