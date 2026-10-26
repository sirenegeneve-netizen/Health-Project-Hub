"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";

export interface DeclinationRow {
  cycleId: string;
  establishmentId: string | null;
  establishmentName: string;
  statutLabel: string;
  etat: string | null;
  etatLabel: string;
  progressText: string;
  derogation: { statut: string; motif: string | null; demandeePar: string | null; decisionPar: string | null; decisionNote: string | null } | null;
  changesPending: number;
}

// Déclinaisons d'un objectif de groupe : état de chaque établissement, décisions de dérogation, hors périmètre.
export function DeclinationsTable({ rows, canDecide }: { rows: DeclinationRow[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function decide(cycleId: string, action: "valider" | "refuser" | "revoquer") {
    let note: string | undefined;
    if (action === "refuser") {
      note = prompt("Motif du refus (obligatoire) :") || "";
      if (!note.trim()) return;
    } else if (action === "revoquer") {
      note = prompt("Note de révocation (facultative) :") || undefined;
    } else if (!confirm("Valider la dérogation ? L'objectif deviendra « non applicable » pour cet établissement.")) return;
    setBusy(cycleId);
    setMsg(null);
    const res = await callApi("POST", `/api/objectives/${cycleId}/derogation`, { action, note });
    setBusy(null);
    if (!res.ok) return setMsg(res.error || "Erreur.");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {msg && <p className="text-sm text-bad">{msg}</p>}
      <ul className="card !p-0 divide-y divide-ink/5">
        {rows.map((r) => (
          <li key={r.cycleId} className="px-4 py-3 text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {r.establishmentId ? (
                  <Link href={`/establishments/${r.establishmentId}/objectifs/${r.cycleId}`} className="text-blue hover:underline">
                    {r.establishmentName}
                  </Link>
                ) : (
                  r.establishmentName
                )}
                <span className="text-xs text-muted"> · {r.statutLabel}</span>
              </span>
              <span className="font-medium text-ink">{r.etatLabel}</span>
            </div>
            <div className="text-xs text-muted">{r.progressText}</div>
            {r.changesPending > 0 && <div className="text-xs text-warn">{r.changesPending} changement(s) du groupe non examiné(s)</div>}
            {r.derogation && (
              <div className="rounded border border-line px-3 py-2 space-y-1">
                <div>
                  Dérogation {r.derogation.statut === "demandee" ? "demandée" : r.derogation.statut === "validee" ? "validée" : "refusée"}
                  {r.derogation.demandeePar ? ` par ${r.derogation.demandeePar}` : ""}
                </div>
                {r.derogation.motif && <div className="text-muted">Motif : {r.derogation.motif}</div>}
                {r.derogation.decisionNote && <div className="text-muted">Décision : {r.derogation.decisionNote}</div>}
                {canDecide && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.derogation.statut === "demandee" && (
                      <>
                        <button className="btn" disabled={busy === r.cycleId} onClick={() => decide(r.cycleId, "valider")}>
                          Valider
                        </button>
                        <button className="btn-secondary" disabled={busy === r.cycleId} onClick={() => decide(r.cycleId, "refuser")}>
                          Refuser
                        </button>
                      </>
                    )}
                    {r.derogation.statut === "validee" && (
                      <button className="btn-secondary" disabled={busy === r.cycleId} onClick={() => decide(r.cycleId, "revoquer")}>
                        Révoquer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
