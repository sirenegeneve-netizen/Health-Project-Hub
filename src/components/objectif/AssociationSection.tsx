"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";

export interface AssocItem {
  key: string; // identifiant du lien (ou de la contribution / du document)
  label: string;
  sub?: string;
  href?: string;
  removable?: boolean;
}

export interface AssocCandidate {
  id: string;
  label: string;
  sub?: string;
}

// Section d'association générique de la fiche objectif : liste des éléments reliés + « + Associer » parmi des
// éléments EXISTANTS du même périmètre (aucune duplication). `mode` choisit l'API appelée.
export function AssociationSection({
  cycleId,
  mode,
  items,
  candidates,
  emptyText,
  addLabel,
  noCandidatesText,
}: {
  cycleId: string;
  mode: "risque" | "decision" | "constat" | "exigence" | "initiative" | "document";
  items: AssocItem[];
  candidates: AssocCandidate[];
  emptyText: string;
  addLabel: string;
  noCandidatesText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!sel) return;
    setBusy(true);
    let res;
    if (mode === "initiative") res = await callApi("POST", "/api/initiative-goal-contributions", { initiativeId: sel, strategicGoalCycleId: cycleId, niveau: "principale" });
    else if (mode === "document") res = await callApi("PATCH", `/api/documents/${sel}`, { linkedType: "objectif", linkedId: cycleId });
    else res = await callApi("POST", `/api/objectives/${cycleId}/links`, { kind: mode, targetId: sel });
    setBusy(false);
    if (!res.ok) return alert(res.error);
    setSel("");
    setOpen(false);
    router.refresh();
  }

  async function remove(item: AssocItem) {
    if (mode === "initiative") await callApi("DELETE", `/api/initiative-goal-contributions/${item.key}`);
    else if (mode === "document") await callApi("PATCH", `/api/documents/${item.key}`, { linkedType: null });
    else await callApi("DELETE", `/api/objective-links/${item.key}`);
    router.refresh();
  }

  return (
    <div>
      {items.length === 0 ? (
        <div className="card text-center text-muted py-5 mb-3 text-sm">{emptyText}</div>
      ) : (
        <ul className="card !p-0 divide-y divide-ink/5 mb-3">
          {items.map((it) => (
            <li key={it.key} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                {it.href ? (
                  <Link href={it.href} className="text-blue hover:underline">
                    {it.label}
                  </Link>
                ) : (
                  it.label
                )}
                {it.sub && <span className="text-xs text-muted"> · {it.sub}</span>}
              </span>
              {it.removable !== false && (
                <button className="text-xs text-muted hover:text-bad hover:underline shrink-0" onClick={() => remove(it)}>
                  {mode === "document" ? "Détacher" : "Retirer le lien"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="card flex flex-wrap gap-2 items-end">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">{noCandidatesText}</p>
          ) : (
            <>
              <select className="input flex-1 min-w-[220px]" value={sel} onChange={(e) => setSel(e.target.value)}>
                <option value="">— Choisir —</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.sub ? ` (${c.sub})` : ""}
                  </option>
                ))}
              </select>
              <button className="btn" disabled={busy || !sel} onClick={add}>
                Associer
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
