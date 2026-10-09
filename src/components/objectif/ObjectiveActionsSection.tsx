"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { ActionStatusSelect } from "@/components/ActionPlanClient";
import { callApi } from "@/components/projectConfig/api";

export interface ObjectiveActionView {
  id: string;
  title: string;
  status: string;
  priority: string;
  echeance: string | null;
  responsable: string | null;
  livrable: string | null;
  indicatorName: string | null;
  origine: string | null;
}

const ORIGINES: Record<string, string> = {
  manuel: "Saisie directe",
  audit: "Audit / constat",
  risque: "Risque",
  incident: "Incident",
  decision: "Décision / COPIL",
  reunion: "Réunion",
  reglementaire: "Exigence réglementaire",
  complement: "Action complémentaire",
};
const PRIORITY_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { basse: "neutral", normale: "neutral", haute: "warn", critique: "bad" };

function StatusMark({ status }: { status: string }) {
  if (status === "termine") return <span className="text-teal-700 w-4 inline-block">✓</span>;
  if (status === "en_cours") return <span className="text-amber-600 w-4 inline-block">→</span>;
  if (status === "abandonne") return <span className="text-muted w-4 inline-block">×</span>;
  return <span className="text-muted w-4 inline-block">○</span>;
}

// Actions de l'objectif : l'objectif est un objet vivant, on peut en ajouter à tout moment (audit, risque, incident,
// COPIL, exigence réglementaire, action complémentaire…).
export function ObjectiveActionsSection({
  cycleId,
  ownerType,
  ownerId,
  actions,
  indicators,
  actors,
}: {
  cycleId: string;
  ownerType: "groupe" | "etablissement";
  ownerId: string;
  actions: ObjectiveActionView[];
  indicators: { id: string; nom: string }[];
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty = { title: "", description: "", responsableActorId: "", priority: "normale", echeance: "", livrable: "", indicatorId: "", origine: "manuel" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = Date.now();

  async function create() {
    setError("");
    setBusy(true);
    const res = await callApi("POST", "/api/actions", {
      ownerType,
      ownerId,
      establishmentId: ownerType === "etablissement" ? ownerId : null,
      strategicGoalCycleId: cycleId,
      indicatorId: f.indicatorId || null,
      title: f.title,
      comments: f.description || null,
      responsableActorId: f.responsableActorId || null,
      priority: f.priority,
      echeance: f.echeance || null,
      livrable: f.livrable || null,
      origine: f.origine,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    setF(empty);
    setOpen(false);
    router.refresh();
  }

  return (
    <div>
      {actions.length === 0 ? (
        <div className="card text-center text-muted py-6 mb-3">Aucune action pour le moment — l'objectif peut être complété à tout moment.</div>
      ) : (
        <div className="card !p-0 divide-y divide-ink/5 mb-3">
          {actions.map((a) => {
            const overdue = a.echeance && new Date(a.echeance).getTime() < now && a.status !== "termine" && a.status !== "abandonne";
            return (
              <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <div className={a.status === "termine" ? "text-muted line-through" : "text-ink"}>
                    <StatusMark status={a.status} /> {a.title}
                  </div>
                  <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-4">
                    {a.responsable && <span>{a.responsable}</span>}
                    {a.echeance && <span className={overdue ? "text-bad" : ""}>échéance {new Date(a.echeance).toLocaleDateString("fr-FR")}</span>}
                    {a.livrable && <span>livrable : {a.livrable}</span>}
                    {a.indicatorName && <span>indicateur : {a.indicatorName}</span>}
                    {a.origine && a.origine !== "manuel" && <span>origine : {ORIGINES[a.origine] || a.origine}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill text={a.priority} tone={PRIORITY_TONE[a.priority] || "neutral"} />
                  <ActionStatusSelect actionId={a.id} status={a.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <div className="card space-y-2">
          <label className="block">
            <div className="label mb-1">Action *</div>
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block">
            <div className="label mb-1">Description</div>
            <textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="block">
              <div className="label mb-1">Responsable</div>
              <select className="input" value={f.responsableActorId} onChange={(e) => setF({ ...f, responsableActorId: e.target.value })}>
                <option value="">— Non assigné —</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="label mb-1">Priorité</div>
              <select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique</option>
              </select>
            </label>
            <label className="block">
              <div className="label mb-1">Échéance</div>
              <input type="date" className="input" value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <div className="label mb-1">Livrable / preuve attendue</div>
              <input className="input" value={f.livrable} onChange={(e) => setF({ ...f, livrable: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Origine</div>
              <select className="input" value={f.origine} onChange={(e) => setF({ ...f, origine: e.target.value })}>
                {Object.entries(ORIGINES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {indicators.length > 0 && (
            <label className="block">
              <div className="label mb-1">Indicateur associé (si pertinent)</div>
              <select className="input" value={f.indicatorId} onChange={(e) => setF({ ...f, indicatorId: e.target.value })}>
                <option value="">— Aucun —</option>
                {indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button className="btn" disabled={busy || !f.title.trim()} onClick={create}>
              Ajouter l'action
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          + Ajouter une action
        </button>
      )}
    </div>
  );
}
