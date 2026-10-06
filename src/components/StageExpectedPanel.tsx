"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";

export interface ExpectedRow {
  kind: string;
  label: string;
  obligatoire: boolean;
  state: "missing" | "in_progress" | "done" | "untracked";
}

const KIND_LABEL: Record<string, string> = {
  livrable: "Livrable",
  action: "Action",
  decision: "Décision",
  risque: "Risque type",
  indicateur: "Indicateur",
  role: "Rôle",
  information: "Information attendue",
};
const KIND_ORDER = ["livrable", "action", "decision", "risque", "indicateur", "role", "information"];
const STATE: Record<string, { text: string; tone: "ok" | "warn" | "neutral" | "bad" }> = {
  done: { text: "Fait", tone: "ok" },
  in_progress: { text: "En cours", tone: "warn" },
  missing: { text: "À créer", tone: "neutral" },
};

// Éléments attendus à cette étape (copie figée du modèle). « Créer » ajoute l'objet HPH réel
// (livrable, action, décision, risque, indicateur) rattaché à l'étape — pas de doublon avec l'existant.
export function StageExpectedPanel({ initiativeId, stageKey, items }: { initiativeId: string; stageKey: string; items: ExpectedRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function create(it: ExpectedRow) {
    let value: number | undefined;
    if (it.kind === "indicateur") {
      const raw = prompt(`Valeur actuelle de l'indicateur « ${it.label} » :`);
      if (raw === null) return;
      value = Number(raw.replace(",", "."));
      if (Number.isNaN(value)) return alert("Valeur numérique requise.");
    }
    setPending(it.label);
    const res = await fetch(`/api/initiatives/${initiativeId}/stages/${stageKey}/expected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: it.kind, label: it.label, value }),
    });
    setPending(null);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Erreur.");
    router.refresh();
  }

  const groups = KIND_ORDER.map((k) => ({ kind: k, rows: items.filter((i) => i.kind === k) })).filter((g) => g.rows.length > 0);

  return (
    <div className="card divide-y divide-ink/5 !p-0">
      {groups.map((g) => (
        <div key={g.kind} className="px-4 py-3">
          <div className="label mb-2">{KIND_LABEL[g.kind]}s</div>
          <ul className="space-y-1.5">
            {g.rows.map((it) => (
              <li key={`${it.kind}-${it.label}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-body">
                  {it.label}
                  {!it.obligatoire && <span className="ml-2 text-xs text-ink/40">optionnel</span>}
                </span>
                {it.state === "untracked" ? null : (
                  <span className="flex items-center gap-2 shrink-0">
                    <Pill text={STATE[it.state].text} tone={STATE[it.state].tone} />
                    {it.state === "missing" && (
                      <button className="text-blue hover:underline disabled:opacity-50" disabled={pending === it.label} onClick={() => create(it)}>
                        Créer
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
