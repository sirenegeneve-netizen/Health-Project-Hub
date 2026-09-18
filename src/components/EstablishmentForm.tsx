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

// groupId : quand fourni (ex. depuis la fiche d'un groupe), le rattachement
// est fixé et non modifiable. Sinon, `groups` doit être fourni pour permettre
// de choisir explicitement le groupe (ex. page /establishments, tous groupes confondus).
export function EstablishmentForm({ groupId, groups }: { groupId?: string; groups?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    type: "hopital",
    localisation: "",
    groupId: groupId || groups?.[0]?.id || "",
  });

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Nouvel établissement
      </button>
    );
  }

  const noGroupAvailable = !groupId && (!groups || groups.length === 0);

  if (noGroupAvailable) {
    return (
      <div className="card mb-4 space-y-3">
        <p className="text-sm text-bad">Créez d'abord un groupe (page Groupes) avant de pouvoir créer un établissement.</p>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
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
      {!groupId && groups && (
        <label className="block">
          <div className="label mb-1">Groupe</div>
          <select className="input" value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <div className="label mb-1">Localisation</div>
        <input className="input" value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ville, région…" />
      </label>
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy || !f.name || !f.groupId}
          onClick={async () => {
            setBusy(true);
            try {
              await fetch("/api/establishments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(f),
              });
              setOpen(false);
              router.refresh();
            } finally {
              setBusy(false);
            }
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
