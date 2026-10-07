"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActorSelect } from "@/components/ActorSelect";
import { Toggle, Field, inputCls, post } from "@/components/EntityForms";

export const ACTION_STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  termine: "Terminée",
  abandonne: "Abandonnée",
};

export function ActionStatusSelect({ actionId, status }: { actionId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  return (
    <select
      className="input !py-1 text-xs w-28"
      value={value}
      onChange={async (e) => {
        const next = e.target.value;
        setValue(next);
        const res = await fetch(`/api/actions/${actionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
        if (!res.ok) setValue(status);
        router.refresh();
      }}
    >
      {Object.entries(ACTION_STATUS_LABELS).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

// Nouvelle action du plan d'action d'un groupe ou d'un établissement, rattachée à un objectif.
export function PlanActionForm({
  ownerType,
  ownerId,
  objectives,
  actors,
}: {
  ownerType: "groupe" | "etablissement";
  ownerId: string;
  objectives: { id: string; label: string }[];
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const empty = { title: "", strategicGoalCycleId: "", livrable: "", priority: "normale", responsableActorId: "", echeance: "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState("");
  return (
    <Toggle label="+ Nouvelle action du plan">
      {(close) => (
        <>
          <Field label="Action">
            <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objectif">
              <select className={inputCls} value={f.strategicGoalCycleId} onChange={(e) => setF({ ...f, strategicGoalCycleId: e.target.value })}>
                <option value="">— Aucun objectif lié —</option>
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Livrable / preuve attendu">
              <input className={inputCls} placeholder="Ex. procédure validée, compte rendu d'audit…" value={f.livrable} onChange={(e) => setF({ ...f, livrable: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Priorité">
              <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique</option>
              </select>
            </Field>
            <Field label="Responsable">
              <ActorSelect actors={actors} value={f.responsableActorId} onChange={(id) => setF({ ...f, responsableActorId: id })} />
            </Field>
            <Field label="Échéance">
              <input type="date" className={inputCls} value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted">La cible et les indicateurs affichés dans le tableau sont ceux de l'objectif choisi.</p>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.title.trim()) return;
                setError("");
                const res = await post("/api/actions", {
                  ownerType,
                  ownerId,
                  title: f.title,
                  strategicGoalCycleId: f.strategicGoalCycleId || null,
                  livrable: f.livrable || null,
                  priority: f.priority,
                  responsableActorId: f.responsableActorId || null,
                  echeance: f.echeance || null,
                  establishmentId: ownerType === "etablissement" ? ownerId : null,
                  origine: "manuel",
                });
                if (!res.ok) {
                  setError((await res.json().catch(() => ({}))).error || "Erreur.");
                  return;
                }
                setF(empty);
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}
