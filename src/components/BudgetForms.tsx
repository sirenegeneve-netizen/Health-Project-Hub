"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEur } from "@/lib/metrics";

const CATEGORIES = [
  ["prestation", "Prestation"],
  ["licence", "Licence"],
  ["ressource", "Ressource interne"],
  ["deplacement", "Déplacement"],
  ["fournisseur", "Fournisseur"],
  ["autre", "Autre"],
];

export function BudgetTargetsForm({
  projectId,
  budgetInitialEur,
  budgetReviseEur,
}: {
  projectId: string;
  budgetInitialEur: number | null;
  budgetReviseEur: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(budgetInitialEur === null);
  const [initial, setInitial] = useState(budgetInitialEur !== null ? String(budgetInitialEur) : "");
  const [revise, setRevise] = useState(budgetReviseEur !== null ? String(budgetReviseEur) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetInitialEur: initial || null, budgetReviseEur: revise || null }),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="text-sm text-teal-700 hover:underline mb-4" onClick={() => setOpen(true)}>
        Modifier le budget cible
      </button>
    );
  }

  return (
    <div className="card mb-6 space-y-3">
      <div className="font-medium">Budget cible</div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <div className="label mb-1">Budget initial (€)</div>
          <input type="number" className="input" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </label>
        <label className="block">
          <div className="label mb-1">Budget révisé (€) — optionnel</div>
          <input type="number" className="input" value={revise} onChange={(e) => setRevise(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {budgetInitialEur !== null && (
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

export function BudgetLineForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ libelle: "", categorie: "prestation", fournisseur: "", prevision: "", engage: "", reel: "" });

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Ligne budgétaire
      </button>
    );
  }

  return (
    <div className="card mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Libellé</div>
          <input className="input" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Catégorie</div>
          <select className="input" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <div className="label mb-1">Fournisseur</div>
        <input className="input" value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <div className="label mb-1">Prévision (€)</div>
          <input type="number" className="input" value={f.prevision} onChange={(e) => setF({ ...f, prevision: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Engagé (€)</div>
          <input type="number" className="input" value={f.engage} onChange={(e) => setF({ ...f, engage: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Réel (€)</div>
          <input type="number" className="input" value={f.reel} onChange={(e) => setF({ ...f, reel: e.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="btn"
          onClick={async () => {
            if (!f.libelle) return;
            await fetch("/api/budget-lines", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, ...f }),
            });
            setOpen(false);
            router.refresh();
          }}
        >
          Ajouter
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}

interface Line {
  id: string;
  libelle: string;
  categorie: string | null;
  prevision: number;
  engage: number;
  reel: number;
}

export function BudgetLinesTable({ lines }: { lines: Line[] }) {
  const router = useRouter();

  async function updateField(id: string, field: "prevision" | "engage" | "reel", value: string) {
    await fetch(`/api/budget-lines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/budget-lines/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="table-hp">
        <thead>
          <tr className="bg-teal-50/50">
            <th className="pl-4">Libellé</th>
            <th>Catégorie</th>
            <th>Prévision</th>
            <th>Engagé</th>
            <th>Réel</th>
            <th>Écart</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="pl-4">{l.libelle}</td>
              <td className="text-sm text-ink/60">{l.categorie || "—"}</td>
              <td>
                <NumberCell value={l.prevision} onSave={(v) => updateField(l.id, "prevision", v)} />
              </td>
              <td>
                <NumberCell value={l.engage} onSave={(v) => updateField(l.id, "engage", v)} />
              </td>
              <td>
                <NumberCell value={l.reel} onSave={(v) => updateField(l.id, "reel", v)} />
              </td>
              <td className={l.prevision - l.reel < 0 ? "text-bad" : "text-ok"}>{formatEur(l.prevision - l.reel)}</td>
              <td>
                <button className="text-xs text-ink/40 hover:text-bad" onClick={() => remove(l.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberCell({ value, onSave }: { value: number; onSave: (v: string) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <input
      type="number"
      className="w-24 border border-transparent hover:border-teal-100 focus:border-teal-300 rounded px-1.5 py-0.5 text-sm bg-transparent focus:outline-none"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== String(value) && onSave(v)}
    />
  );
}
