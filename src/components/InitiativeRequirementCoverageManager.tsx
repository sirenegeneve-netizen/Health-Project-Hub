"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InitiativeRequirementCoverageManager({
  initiativeId,
  linked,
  available,
}: {
  initiativeId: string;
  linked: { linkId: string; requirementId: string; label: string }[];
  available: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");

  async function addCoverage() {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch("/api/initiative-requirement-coverages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiativeId, qualityRequirementId: selected }),
      });
      setSelected("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeCoverage(linkId: string) {
    setBusy(true);
    try {
      await fetch(`/api/initiative-requirement-coverages/${linkId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {linked.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {linked.map((c) => (
            <span key={c.linkId} className="inline-flex items-center gap-1.5 rounded bg-ink/5 text-ink/70 px-2 py-0.5 text-xs font-medium">
              {c.label}
              <button
                type="button"
                aria-label={`Retirer ${c.label}`}
                className="text-ink/40 hover:text-bad"
                disabled={busy}
                onClick={() => removeCoverage(c.linkId)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted mb-3">Aucune exigence qualité couverte par cette initiative.</p>
      )}

      {available.length > 0 ? (
        <div className="flex gap-2">
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">— Choisir une exigence —</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary text-sm" disabled={busy || !selected} onClick={addCoverage}>
            + Couvrir
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">Aucune exigence qualité applicable déclarée pour ce groupe ou ses établissements.</p>
      )}
    </div>
  );
}
