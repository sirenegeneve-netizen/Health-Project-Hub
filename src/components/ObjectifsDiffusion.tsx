"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, error: data?.error as string | undefined };
}

// Pastille « Hérité du groupe » (copie verrouillée côté établissement).
export function InheritedPill() {
  return <Pill text="Hérité du groupe" tone="neutral" />;
}

// Diffuser un plan / un objectif du groupe déjà créé vers les établissements rattachés.
export function DiffuseButton({ kind, id, establishmentCount }: { kind: "plan" | "objectif"; id: string; establishmentCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (establishmentCount === 0) return null;
  return (
    <button
      className="text-xs text-blue hover:underline disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Diffuser ${kind === "plan" ? "ce plan" : "cet objectif"} aux ${establishmentCount} établissement(s) rattaché(s) ? Ils le recevront avec un libellé verrouillé ; chacun saisira sa cible et ses indicateurs. Cette diffusion ne peut pas être retirée.`)) return;
        setBusy(true);
        const res = await call("PATCH", `/api/${kind === "plan" ? "strategic-plans" : "strategic-goals"}/${id}`, { diffuse: true });
        setBusy(false);
        if (!res.ok) return alert(res.error || "Erreur.");
        router.refresh();
      }}
    >
      Diffuser aux établissements
    </button>
  );
}

// Complète les plans, objectifs et déclinaisons manquants dans les établissements du groupe.
export function ResyncButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await call("POST", `/api/groups/${groupId}/diffusion`);
        setBusy(false);
        if (!res.ok) return alert(res.error || "Erreur.");
        const d = res.data;
        alert(`Synchronisation terminée : ${d.plansCreated} plan(s), ${d.goalsCreated} objectif(s) et ${d.cyclesCreated} déclinaison(s) ajouté(s).`);
        router.refresh();
      }}
    >
      Resynchroniser les établissements
    </button>
  );
}

// Cible et indicateurs d'une déclinaison (objectif × plan) : propres à chaque groupe / établissement.
export function CycleTargetCell({ cycleId, cible, indicateurs }: { cycleId: string; cible: string | null; indicateurs: string | null }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ cible: cible || "", indicateurs: indicateurs || "" });
  const [busy, setBusy] = useState(false);

  if (!edit) {
    return (
      <div className="text-sm">
        <div>
          <span className="text-xs text-muted">Cible : </span>
          {cible || <span className="text-muted">—</span>}
        </div>
        <div>
          <span className="text-xs text-muted">Indicateurs : </span>
          {indicateurs || <span className="text-muted">—</span>}
        </div>
        <button className="text-xs text-blue hover:underline mt-0.5" onClick={() => setEdit(true)}>
          Modifier
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 min-w-[220px]">
      <input className="input" placeholder="Cible (ex. 95 % d'ici 2027)" value={f.cible} onChange={(e) => setF({ ...f, cible: e.target.value })} />
      <input className="input" placeholder="Indicateurs" value={f.indicateurs} onChange={(e) => setF({ ...f, indicateurs: e.target.value })} />
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await call("PATCH", `/api/strategic-goal-cycles/${cycleId}`, { cible: f.cible || null, indicateurs: f.indicateurs || null });
            setBusy(false);
            if (!res.ok) return alert(res.error || "Erreur.");
            setEdit(false);
            router.refresh();
          }}
        >
          Enregistrer
        </button>
        <button className="btn-secondary" onClick={() => setEdit(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
