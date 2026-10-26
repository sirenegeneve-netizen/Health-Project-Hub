"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";

interface Plan {
  targets: number;
  toCreate: number;
  toRestore: number;
  toRemove: number;
}

// Diffusion d'un objectif de groupe : tous les établissements (y compris ceux rattachés plus tard) ou une sélection.
// Simulation d'abord, puis application. Un établissement retiré garde sa déclinaison (« Hors périmètre ») : rien n'est supprimé.
export function DiffusionSelector({
  cycleId,
  establishments,
  mode,
  targetIds,
  canDiffuse,
}: {
  cycleId: string;
  establishments: { id: string; name: string }[];
  mode: string;
  targetIds: string[];
  canDiffuse: boolean;
}) {
  const router = useRouter();
  const [m, setM] = useState<"tous" | "selection">(mode === "selection" ? "selection" : "tous");
  const [ids, setIds] = useState<string[]>(targetIds);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (establishments.length === 0) return <p className="text-sm text-muted">Aucun établissement rattaché à ce groupe pour le moment.</p>;
  const diffused = mode !== "aucune";
  if (!canDiffuse) {
    return <p className="text-sm text-muted">{diffused ? (mode === "selection" ? "Diffusé à une sélection d'établissements." : "Diffusé à tous les établissements.") : "Non diffusé aux établissements."} Seul le directeur ou l'administrateur du groupe peut modifier la diffusion.</p>;
  }

  const body = () => ({ mode: m, establishmentIds: m === "selection" ? ids : undefined });
  const toggle = (id: string) => {
    setPlan(null);
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  async function simulate() {
    setBusy(true);
    setMsg(null);
    const res = await callApi("POST", `/api/objectives/${cycleId}/diffuse`, { ...body(), dryRun: true });
    setBusy(false);
    if (!res.ok) return setMsg(res.error || "Erreur.");
    setPlan(res.data as Plan);
  }

  async function apply() {
    const warn = plan && plan.toRemove > 0 ? `\n\n${plan.toRemove} établissement(s) sortent du périmètre : leur déclinaison, leurs actions, mesures et preuves sont conservées (statut « Hors périmètre »).` : "";
    if (!confirm(`Appliquer la diffusion ?${warn}`)) return;
    setBusy(true);
    setMsg(null);
    const res = await callApi("POST", `/api/objectives/${cycleId}/diffuse`, body());
    setBusy(false);
    if (!res.ok) return setMsg(res.error || "Erreur.");
    setPlan(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={m === "tous"} onChange={() => { setM("tous"); setPlan(null); }} /> Tous les établissements
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={m === "selection"} onChange={() => { setM("selection"); setPlan(null); }} /> Une sélection
        </label>
      </div>
      {m === "tous" && <p className="text-xs text-muted">Les établissements rattachés plus tard recevront aussi cet objectif.</p>}
      {m === "selection" && (
        <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
          {establishments.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-2 rounded border border-line px-3 py-2">
                <input type="checkbox" checked={ids.includes(e.id)} onChange={() => toggle(e.id)} /> {e.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      {plan && (
        <div className="rounded border border-line bg-primary-50 px-3 py-2 text-sm">
          Simulation : {plan.targets} destinataire(s) · {plan.toCreate} déclinaison(s) à créer · {plan.toRestore} à restaurer · {plan.toRemove} à passer « Hors périmètre ». Rien n'est encore écrit.
        </div>
      )}
      {msg && <p className="text-sm text-bad">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={simulate}>
          Simuler
        </button>
        <button className="btn" disabled={busy || !plan} onClick={apply}>
          {diffused ? "Appliquer la diffusion" : "Diffuser"}
        </button>
      </div>
    </div>
  );
}
