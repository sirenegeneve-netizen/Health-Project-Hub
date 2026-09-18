"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InitiativeEstablishmentManager({
  initiativeId,
  linked,
  available,
}: {
  initiativeId: string;
  linked: { linkId: string; id: string; name: string }[];
  available: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");

  async function addEstablishment() {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch("/api/initiative-establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiativeId, establishmentId: selected }),
      });
      setSelected("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeEstablishment(linkId: string) {
    setBusy(true);
    try {
      await fetch(`/api/initiative-establishments/${linkId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {linked.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {linked.map((e) => (
            <span key={e.linkId} className="inline-flex items-center gap-1.5 rounded bg-ink/5 text-ink/70 px-2 py-0.5 text-xs font-medium">
              {e.name}
              <button
                type="button"
                aria-label={`Retirer ${e.name}`}
                className="text-ink/40 hover:text-bad"
                disabled={busy}
                onClick={() => removeEstablishment(e.linkId)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted mb-3">Aucun établissement rattaché.</p>
      )}

      {available.length > 0 ? (
        <div className="flex gap-2">
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">— Choisir un établissement du groupe —</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button className="btn-secondary text-sm" disabled={busy || !selected} onClick={addEstablishment}>
            + Rattacher
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">Tous les établissements du groupe sont déjà rattachés.</p>
      )}
    </div>
  );
}
