"use client";

import { useState } from "react";

export interface Option {
  code: string;
  label: string;
}

// Sélection multiple lisible : éléments retenus en pastilles retirables, puis liste à cocher en colonnes
// (filtrable dès que la liste est longue). Utilisable pour les périmètres, populations et établissements.
export function MultiSelectChips({
  options,
  value,
  onChange,
  placeholder = "Rechercher…",
  emptyLabel = "Aucune sélection",
}: {
  options: readonly Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  const labelOf = (code: string) => options.find((o) => o.code === code)?.label || code;
  const filtered = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <div className="rounded-md border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-ink/5 min-h-[2.5rem]">
        {value.length === 0 && <span className="text-xs text-muted px-1">{emptyLabel}</span>}
        {value.map((code) => (
          <span key={code} className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 text-xs px-2 py-1">
            {labelOf(code)}
            <button type="button" aria-label={`Retirer ${labelOf(code)}`} className="hover:text-bad" onClick={() => toggle(code)}>
              ×
            </button>
          </span>
        ))}
        {value.length > 0 && (
          <button type="button" className="ml-auto text-xs text-blue hover:underline" onClick={() => onChange([])}>
            Tout effacer
          </button>
        )}
      </div>
      {options.length > 8 && (
        <div className="p-2 border-b border-ink/5">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto p-2 grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1">
        {filtered.map((o) => (
          <label key={o.code} className="flex items-start gap-2 text-sm py-0.5 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={value.includes(o.code)} onChange={() => toggle(o.code)} />
            <span>{o.label}</span>
          </label>
        ))}
        {filtered.length === 0 && <span className="text-xs text-muted">Aucun résultat.</span>}
      </div>
    </div>
  );
}
