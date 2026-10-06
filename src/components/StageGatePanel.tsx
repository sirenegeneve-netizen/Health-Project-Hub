"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";

interface Condition {
  key: string;
  label: string;
  met: boolean;
  detail?: string;
}

interface HistoryRow {
  id: string;
  outcome: string;
  comment: string | null;
  userName: string | null;
  unmetCount: number;
  createdAt: string;
}

const OUTCOME: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  go: { text: "GO", tone: "ok" },
  go_reserves: { text: "GO avec réserves", tone: "warn" },
  no_go: { text: "NO GO", tone: "bad" },
};

// Gate de l'étape : conditions de passage, mode (consultatif / bloquant), décision historisée.
export function StageGatePanel({
  initiativeId,
  stageKey,
  mode,
  conditions,
  allowed,
  hasNext,
  history,
}: {
  initiativeId: string;
  stageKey: string;
  mode: "consultatif" | "bloquant";
  conditions: Condition[];
  allowed: boolean;
  hasNext: boolean;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const unmet = conditions.filter((c) => !c.met);

  async function decide(outcome: string) {
    if (outcome !== "go" && !comment.trim()) return alert("Un commentaire est requis pour un GO avec réserves ou un NO GO.");
    if (outcome === "go" && unmet.length > 0 && !confirm(`${unmet.length} condition(s) non réunie(s). Confirmer le GO ?`)) return;
    setBusy(true);
    const res = await fetch(`/api/initiatives/${initiativeId}/stages/${stageKey}/gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, comment: comment.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "Erreur.");
    setComment("");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Pill text={mode === "bloquant" ? "Gate bloquant" : "Gate consultatif"} tone={mode === "bloquant" ? "bad" : "neutral"} />
          {unmet.length === 0 ? <Pill text="Conditions réunies" tone="ok" /> : <Pill text={`${unmet.length} condition${unmet.length > 1 ? "s" : ""} non réunie${unmet.length > 1 ? "s" : ""}`} tone="warn" />}
        </div>
      </div>

      <ul className="space-y-1.5 mb-4">
        {conditions.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            <span className={c.met ? "text-ok" : "text-warn"}>{c.met ? "✓" : "⚠"}</span>
            <span className="text-body">{c.label}</span>
            {c.detail && <span className="text-xs text-ink/50">({c.detail})</span>}
          </li>
        ))}
      </ul>

      {mode === "bloquant" && !allowed && (
        <p className="text-sm text-bad mb-3">Passage impossible à l'étape suivante tant que les conditions ne sont pas réunies.</p>
      )}
      {mode === "consultatif" && unmet.length > 0 && <p className="text-sm text-warn mb-3">Passage possible, mais avec alerte.</p>}

      <textarea className="input mb-2" rows={2} placeholder="Commentaire (obligatoire pour un GO avec réserves ou un NO GO)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2 flex-wrap">
        <button className="btn" disabled={busy || !allowed} onClick={() => decide("go")}>
          GO{hasNext ? " — étape suivante" : ""}
        </button>
        <button className="btn-secondary" disabled={busy || !allowed} onClick={() => decide("go_reserves")}>
          GO avec réserves
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => decide("no_go")}>
          NO GO
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-5 border-t border-ink/5 pt-3">
          <div className="label mb-2">Historique des décisions</div>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill text={OUTCOME[h.outcome]?.text || h.outcome} tone={OUTCOME[h.outcome]?.tone || "warn"} />
                  <span className="text-ink/60 text-xs">
                    {new Date(h.createdAt).toLocaleString("fr-FR")} · {h.userName || "—"}
                    {h.unmetCount > 0 ? ` · ${h.unmetCount} condition${h.unmetCount > 1 ? "s" : ""} non réunie${h.unmetCount > 1 ? "s" : ""}` : ""}
                  </span>
                </div>
                {h.comment && <div className="text-body mt-0.5">{h.comment}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
