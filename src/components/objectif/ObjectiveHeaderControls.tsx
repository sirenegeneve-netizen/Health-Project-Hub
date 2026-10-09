"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";

export interface ObjectiveEditable {
  libelle: string;
  description: string | null;
  statut: string;
  priorite: string;
  axe: string | null;
  resultatAttendu: string | null;
  perimetre: string | null;
  echeance: string | null;
  responsableActorId: string | null;
}

// Modification des informations de l'objectif. Intitulé et description sont verrouillés sur une déclinaison
// d'établissement (ils suivent le groupe).
export function ObjectiveHeaderControls({ cycleId, value, inherited, actors }: { cycleId: string; value: ObjectiveEditable; inherited: boolean; actors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    libelle: value.libelle,
    description: value.description || "",
    statut: value.statut,
    priorite: value.priorite,
    axe: value.axe || "",
    resultatAttendu: value.resultatAttendu || "",
    perimetre: value.perimetre || "",
    echeance: value.echeance ? value.echeance.slice(0, 10) : "",
    responsableActorId: value.responsableActorId || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Modifier l'objectif
      </button>
    );
  }
  return (
    <div className="card space-y-2 w-full">
      {inherited && <p className="text-xs text-muted">L'intitulé et la description sont hérités du groupe : ils se modifient depuis le groupe.</p>}
      <label className="block">
        <div className="label mb-1">Intitulé</div>
        <input className="input" disabled={inherited} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} />
      </label>
      <label className="block">
        <div className="label mb-1">Description / finalité</div>
        <textarea className="input" rows={3} disabled={inherited} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <label className="block">
        <div className="label mb-1">Résultat attendu</div>
        <textarea className="input" rows={2} value={f.resultatAttendu} onChange={(e) => setF({ ...f, resultatAttendu: e.target.value })} />
      </label>
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="block">
          <div className="label mb-1">Périmètre / population</div>
          <input className="input" value={f.perimetre} onChange={(e) => setF({ ...f, perimetre: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Axe stratégique</div>
          <input className="input" value={f.axe} onChange={(e) => setF({ ...f, axe: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Échéance</div>
          <input type="date" className="input" value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Statut</div>
          <select className="input" value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value })}>
            <option value="actif">Actif</option>
            <option value="atteint">Atteint</option>
            <option value="reporte">Reporté</option>
            <option value="abandonne">Abandonné</option>
          </select>
        </label>
        <label className="block">
          <div className="label mb-1">Priorité</div>
          <select className="input" value={f.priorite} onChange={(e) => setF({ ...f, priorite: e.target.value })}>
            <option value="basse">Basse</option>
            <option value="normale">Normale</option>
            <option value="haute">Haute</option>
            <option value="critique">Critique</option>
          </select>
        </label>
        <label className="block">
          <div className="label mb-1">Responsable / pilote</div>
          <select className="input" value={f.responsableActorId} onChange={(e) => setF({ ...f, responsableActorId: e.target.value })}>
            <option value="">— Non assigné —</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            const body: Record<string, unknown> = {
              statut: f.statut,
              priorite: f.priorite,
              axe: f.axe || null,
              resultatAttendu: f.resultatAttendu || null,
              perimetre: f.perimetre || null,
              echeance: f.echeance || null,
              responsableActorId: f.responsableActorId || null,
            };
            if (!inherited) Object.assign(body, { libelle: f.libelle, description: f.description || null });
            const res = await callApi("PATCH", `/api/objectives/${cycleId}`, body);
            setBusy(false);
            if (!res.ok) return setError(res.error || "Erreur.");
            setOpen(false);
            router.refresh();
          }}
        >
          Enregistrer
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
