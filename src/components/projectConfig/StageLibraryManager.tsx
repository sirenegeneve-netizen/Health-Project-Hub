"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { callApi } from "./api";

export interface StageDefRow {
  id: string;
  key: string;
  label: string;
  objectif: string | null;
  actif: boolean;
  system: boolean;
}

// Bibliothèque d'étapes réutilisables. Modifier une entrée n'affecte ni les modèles existants ni les
// initiatives (ils portent leur propre copie) : seuls les futurs ajouts au parcours en profitent.
export function StageLibraryManager({ defs }: { defs: StageDefRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [objectif, setObjectif] = useState("");

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) alert(res.error);
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await run("new", () => callApi("POST", "/api/stage-definitions", { label, objectif: objectif || undefined }));
    setLabel("");
    setObjectif("");
  }

  return (
    <div>
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 mb-6">
        <label className="block">
          <div className="label mb-1">Nouvelle étape</div>
          <input className="input w-64" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Revue de sécurité" />
        </label>
        <label className="block flex-1 min-w-[240px]">
          <div className="label mb-1">Objectif par défaut (optionnel)</div>
          <input className="input" value={objectif} onChange={(e) => setObjectif(e.target.value)} />
        </label>
        <button className="btn" disabled={busy === "new" || !label.trim()} type="submit">
          Ajouter
        </button>
      </form>

      <div className="card divide-y divide-ink/5 !p-0">
        {defs.map((d) => (
          <div key={d.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink flex items-center gap-2 flex-wrap">
                {d.label}
                {!d.actif && <Pill text="Inactive" tone="warn" />}
                {!d.system && <Pill text="Personnalisée" tone="neutral" />}
              </div>
              {d.objectif && <div className="text-xs text-ink/55 mt-0.5">{d.objectif}</div>}
            </div>
            <div className="flex gap-3 text-sm shrink-0">
              <button
                className="text-blue hover:underline disabled:opacity-50"
                disabled={busy === d.id}
                onClick={() => {
                  const next = prompt("Objectif par défaut de l'étape :", d.objectif || "");
                  if (next !== null) run(d.id, () => callApi("PATCH", `/api/stage-definitions/${d.id}`, { objectif: next }));
                }}
              >
                Objectif
              </button>
              <button
                className="text-blue hover:underline disabled:opacity-50"
                disabled={busy === d.id}
                onClick={() => {
                  const next = prompt("Nouveau libellé :", d.label);
                  if (next && next.trim() && next !== d.label) run(d.id, () => callApi("PATCH", `/api/stage-definitions/${d.id}`, { label: next }));
                }}
              >
                Renommer
              </button>
              <button className="text-blue hover:underline disabled:opacity-50" disabled={busy === d.id} onClick={() => run(d.id, () => callApi("PATCH", `/api/stage-definitions/${d.id}`, { actif: !d.actif }))}>
                {d.actif ? "Désactiver" : "Activer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
