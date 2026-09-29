"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle, Field, inputCls, post } from "@/components/EntityForms";

export function StrategicPlanForm({ ownerType, ownerId }: { ownerType: "groupe" | "etablissement"; ownerId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ libelle: "", startDate: "", endDate: "" });
  return (
    <Toggle label="+ Nouveau plan stratégique">
      {(close) => (
        <>
          <Field label="Libellé">
            <input
              className={inputCls}
              placeholder="Plan stratégique 2026–2028"
              value={f.libelle}
              onChange={(e) => setF({ ...f, libelle: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début">
              <input type="date" className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </Field>
            <Field label="Fin">
              <input type="date" className={inputCls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle || !f.startDate || !f.endDate) return;
                await post("/api/strategic-plans", { ownerType, ownerId, ...f });
                setF({ libelle: "", startDate: "", endDate: "" });
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

export function StrategicGoalForm({ ownerType, ownerId }: { ownerType: "groupe" | "etablissement"; ownerId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ libelle: "", description: "" });
  return (
    <Toggle label="+ Nouvel objectif stratégique">
      {(close) => (
        <>
          <Field label="Libellé">
            <input
              className={inputCls}
              placeholder="Améliorer la sécurité médicamenteuse"
              value={f.libelle}
              onChange={(e) => setF({ ...f, libelle: e.target.value })}
            />
          </Field>
          <Field label="Description (optionnel)">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle) return;
                await post("/api/strategic-goals", { ownerType, ownerId, ...f });
                setF({ libelle: "", description: "" });
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

// Décline un Objectif existant dans un Plan existant (crée le Cycle). Les
// deux listes déroulantes ne proposent que les objets de la même portée
// (owner) — passés déjà filtrés par la page appelante.
export function StrategicGoalCycleForm({
  goals,
  plans,
}: {
  goals: { id: string; libelle: string }[];
  plans: { id: string; libelle: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState({ strategicGoalId: "", strategicPlanId: "", libelle: "", cible: "", indicateurs: "" });
  return (
    <Toggle label="+ Décliner un objectif dans un plan">
      {(close) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objectif">
              <select className={inputCls} value={f.strategicGoalId} onChange={(e) => setF({ ...f, strategicGoalId: e.target.value })}>
                <option value="">— Choisir —</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.libelle}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plan">
              <select className={inputCls} value={f.strategicPlanId} onChange={(e) => setF({ ...f, strategicPlanId: e.target.value })}>
                <option value="">— Choisir —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.libelle}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Reformulation pour ce cycle (optionnel)">
            <input className={inputCls} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cible (optionnel)">
              <input className={inputCls} value={f.cible} onChange={(e) => setF({ ...f, cible: e.target.value })} />
            </Field>
            <Field label="Indicateurs (optionnel)">
              <input className={inputCls} value={f.indicateurs} onChange={(e) => setF({ ...f, indicateurs: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.strategicGoalId || !f.strategicPlanId) return;
                const res = await post("/api/strategic-goal-cycles", f);
                if (res.ok) {
                  setF({ strategicGoalId: "", strategicPlanId: "", libelle: "", cible: "", indicateurs: "" });
                  close();
                  router.refresh();
                }
              }}
            >
              Décliner
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
