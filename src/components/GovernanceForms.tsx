"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle, Field, inputCls, post } from "@/components/EntityForms";

// Portée d'un plan / objectif du groupe : « Groupe seul » ou « Groupe + établissements rattachés ».
function DiffuseChoice({ count, value, onChange }: { count: number; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field label="Portée">
      <div className="space-y-1 text-sm">
        <label className="flex items-start gap-2">
          <input type="radio" checked={value} onChange={() => onChange(true)} className="mt-1" />
          <span>
            Groupe <strong>et</strong> établissements rattachés ({count}) — chaque établissement reçoit l'élément (libellé verrouillé) et saisit sa propre cible, ses indicateurs et son plan d'action
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" checked={!value} onChange={() => onChange(false)} className="mt-1" />
          <span>Groupe seulement</span>
        </label>
      </div>
    </Field>
  );
}

export function StrategicPlanForm({ ownerType, ownerId, establishmentCount = 0 }: { ownerType: "groupe" | "etablissement"; ownerId: string; establishmentCount?: number }) {
  const router = useRouter();
  const [f, setF] = useState({ libelle: "", startDate: "", endDate: "" });
  const [diffuse, setDiffuse] = useState(establishmentCount > 0);
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
          {ownerType === "groupe" && establishmentCount > 0 && <DiffuseChoice count={establishmentCount} value={diffuse} onChange={setDiffuse} />}
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle || !f.startDate || !f.endDate) return;
                await post("/api/strategic-plans", { ownerType, ownerId, ...f, diffuse: ownerType === "groupe" && diffuse });
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

export function StrategicGoalForm({ ownerType, ownerId, establishmentCount = 0 }: { ownerType: "groupe" | "etablissement"; ownerId: string; establishmentCount?: number }) {
  const router = useRouter();
  const [f, setF] = useState({ libelle: "", description: "" });
  const [diffuse, setDiffuse] = useState(establishmentCount > 0);
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
          {ownerType === "groupe" && establishmentCount > 0 && <DiffuseChoice count={establishmentCount} value={diffuse} onChange={setDiffuse} />}
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle) return;
                await post("/api/strategic-goals", { ownerType, ownerId, ...f, diffuse: ownerType === "groupe" && diffuse });
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

export const REFERENTIEL_OPTIONS = ["ISO 9001", "ISO 13485", "ISO 14971", "ISO 27001", "ISO 22301", "RGPD/LPD", "ANQ", "HAS", "interne", "autre"];

export function QualityRequirementForm({ ownerType, ownerId }: { ownerType: "groupe" | "etablissement"; ownerId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ referentiel: "ISO 9001", referentielAutre: "", code: "", libelle: "", description: "" });
  return (
    <Toggle label="+ Nouvelle exigence qualité">
      {(close) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Référentiel">
              <select className={inputCls} value={f.referentiel} onChange={(e) => setF({ ...f, referentiel: e.target.value })}>
                {REFERENTIEL_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            {f.referentiel === "autre" && (
              <Field label="Préciser le référentiel">
                <input className={inputCls} value={f.referentielAutre} onChange={(e) => setF({ ...f, referentielAutre: e.target.value })} />
              </Field>
            )}
            <Field label="Code / clause (optionnel)">
              <input className={inputCls} placeholder="§7.5" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            </Field>
          </div>
          <Field label="Libellé">
            <input className={inputCls} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />
          </Field>
          <Field label="Description (optionnel)">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle) return;
                const referentiel = f.referentiel === "autre" ? f.referentielAutre : f.referentiel;
                if (!referentiel) return;
                await post("/api/quality-requirements", { ownerType, ownerId, referentiel, code: f.code, libelle: f.libelle, description: f.description });
                setF({ referentiel: "ISO 9001", referentielAutre: "", code: "", libelle: "", description: "" });
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

export const FINDING_TYPES: Record<string, string> = { ecart: "Écart", observation: "Observation", point_fort: "Point fort" };

export function AuditFindingForm({
  ownerType,
  ownerId,
  requirements,
}: {
  ownerType: "groupe" | "etablissement";
  ownerId: string;
  requirements: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState({ type: "ecart", libelle: "", description: "", qualityRequirementId: "" });
  return (
    <Toggle label="+ Nouveau constat d'audit">
      {(close) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {Object.entries(FINDING_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exigence liée (optionnel)">
              <select className={inputCls} value={f.qualityRequirementId} onChange={(e) => setF({ ...f, qualityRequirementId: e.target.value })}>
                <option value="">— Aucune —</option>
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Libellé">
            <input className={inputCls} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />
          </Field>
          <Field label="Description (optionnel)">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.libelle) return;
                await post("/api/audit-findings", { ownerType, ownerId, ...f, qualityRequirementId: f.qualityRequirementId || null });
                setF({ type: "ecart", libelle: "", description: "", qualityRequirementId: "" });
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
