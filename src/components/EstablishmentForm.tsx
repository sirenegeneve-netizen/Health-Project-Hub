"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["hopital", "Hôpital"],
  ["clinique", "Clinique"],
  ["ehpad", "EHPAD"],
  ["cabinet", "Cabinet"],
  ["ght", "GHT"],
  ["autre", "Autre"],
];

export function EstablishmentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", type: "hopital", localisation: "" });

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Nouvel établissement
      </button>
    );
  }

  return (
    <div className="card mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Nom</div>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Type</div>
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <div className="label mb-1">Localisation</div>
        <input className="input" value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ville, région…" />
      </label>
      <div className="flex gap-2">
        <button
          className="btn"
          onClick={async () => {
            if (!f.name) return;
            await fetch("/api/establishments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(f),
            });
            setOpen(false);
            router.refresh();
          }}
        >
          Créer
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
