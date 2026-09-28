"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AllocationCell {
  initiativeId: string;
  initiativeName: string;
  joursAlloues: number;
}

export function CapacityHeatmap({
  weeks,
  actors,
  initiatives,
  totals,
  detail,
}: {
  weeks: { start: string; label: string }[];
  actors: { id: string; name: string }[];
  initiatives: { id: string; name: string }[];
  totals: Record<string, Record<string, number>>; // actorId -> weekStart -> total JH
  detail: Record<string, Record<string, AllocationCell[]>>; // actorId -> weekStart -> lignes
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ actorId: string; actorName: string; weekStart: string; label: string } | null>(null);
  const [addForm, setAddForm] = useState({ actorId: "", initiativeId: "", weekStart: weeks[0]?.start || "", joursAlloues: "" });
  const [saving, setSaving] = useState(false);

  function intensity(v: number) {
    if (v <= 0) return "transparent";
    const t = Math.min(v / 8, 1); // magnitude seulement — pas de seuil de surcharge (pas de capacité de référence fiable)
    const alpha = 0.12 + t * 0.55;
    return `rgba(14, 165, 168, ${alpha.toFixed(2)})`;
  }

  async function save(actorId: string, initiativeId: string, weekStart: string, joursAlloues: string) {
    setSaving(true);
    try {
      await fetch("/api/actor-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, initiativeId, weekStart, joursAlloues: joursAlloues === "" ? null : Number(joursAlloues) }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const selectedRows: AllocationCell[] = selected ? detail[selected.actorId]?.[selected.weekStart] || [] : [];
  const [newRow, setNewRow] = useState({ initiativeId: "", joursAlloues: "" });

  return (
    <div>
      <div className="card p-0 overflow-x-auto">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4 sticky left-0 bg-teal-50/50">Acteur</th>
              {weeks.map((w) => (
                <th key={w.start} className="text-center whitespace-nowrap px-2">
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actors.map((a) => (
              <tr key={a.id}>
                <td className="pl-4 font-medium whitespace-nowrap sticky left-0 bg-white">{a.name}</td>
                {weeks.map((w) => {
                  const total = totals[a.id]?.[w.start] || 0;
                  const isSelected = selected?.actorId === a.id && selected?.weekStart === w.start;
                  return (
                    <td key={w.start} className="text-center p-0">
                      <button
                        className={`w-full h-10 text-xs font-medium transition-colors ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                        style={{ backgroundColor: intensity(total) }}
                        onClick={() => {
                          setSelected({ actorId: a.id, actorName: a.name, weekStart: w.start, label: w.label });
                          setNewRow({ initiativeId: "", joursAlloues: "" });
                        }}
                      >
                        {total > 0 ? total : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {actors.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 1} className="text-center text-ink/50 py-10">
                  Aucune allocation déclarée pour l'instant — utilisez "+ Ajouter une allocation" ci-dessous.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/40 mt-2">
        L'intensité de couleur reflète uniquement le total de JH déclarés cette semaine (toutes initiatives confondues) — il n'y a pas de
        seuil de surcharge automatique, faute de capacité de référence fiable par acteur. Cliquez une case pour voir/éditer le détail par
        initiative.
      </p>

      {selected && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-sm">
              {selected.actorName} — semaine du {selected.label}
            </div>
            <button className="text-xs text-ink/40 hover:underline" onClick={() => setSelected(null)}>
              Fermer
            </button>
          </div>
          {selectedRows.length > 0 ? (
            <ul className="space-y-2 mb-3">
              {selectedRows.map((row) => (
                <li key={row.initiativeId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{row.initiativeName}</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input w-24"
                    defaultValue={row.joursAlloues}
                    disabled={saving}
                    onBlur={(e) => save(selected.actorId, row.initiativeId, selected.weekStart, e.target.value)}
                  />
                  <span className="text-xs text-ink/40">JH</span>
                  <button
                    className="text-xs text-bad hover:underline"
                    disabled={saving}
                    onClick={() => save(selected.actorId, row.initiativeId, selected.weekStart, "")}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50 mb-3">Aucune allocation sur cette semaine pour l'instant.</p>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-ink/5">
            <select className="input flex-1" value={newRow.initiativeId} onChange={(e) => setNewRow({ ...newRow, initiativeId: e.target.value })}>
              <option value="">Ajouter une initiative...</option>
              {initiatives
                .filter((i) => !selectedRows.some((r) => r.initiativeId === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input w-24"
              placeholder="JH"
              value={newRow.joursAlloues}
              onChange={(e) => setNewRow({ ...newRow, joursAlloues: e.target.value })}
            />
            <button
              className="btn text-sm"
              disabled={saving || !newRow.initiativeId || !newRow.joursAlloues}
              onClick={async () => {
                await save(selected.actorId, newRow.initiativeId, selected.weekStart, newRow.joursAlloues);
                setNewRow({ initiativeId: "", joursAlloues: "" });
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="card mt-4">
        <div className="font-medium text-sm mb-3">+ Ajouter une allocation</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <div className="label mb-1">Acteur</div>
            <select className="input" value={addForm.actorId} onChange={(e) => setAddForm({ ...addForm, actorId: e.target.value })}>
              <option value="">Choisir...</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="label mb-1">Initiative</div>
            <select className="input" value={addForm.initiativeId} onChange={(e) => setAddForm({ ...addForm, initiativeId: e.target.value })}>
              <option value="">Choisir...</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="label mb-1">Semaine</div>
            <select className="input" value={addForm.weekStart} onChange={(e) => setAddForm({ ...addForm, weekStart: e.target.value })}>
              {weeks.map((w) => (
                <option key={w.start} value={w.start}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="label mb-1">JH</div>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input w-24"
              value={addForm.joursAlloues}
              onChange={(e) => setAddForm({ ...addForm, joursAlloues: e.target.value })}
            />
          </label>
          <button
            className="btn text-sm"
            disabled={saving || !addForm.actorId || !addForm.initiativeId || !addForm.joursAlloues}
            onClick={async () => {
              await save(addForm.actorId, addForm.initiativeId, addForm.weekStart, addForm.joursAlloues);
              setAddForm({ ...addForm, joursAlloues: "" });
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
