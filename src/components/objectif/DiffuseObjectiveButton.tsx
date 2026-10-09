"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";

export function DiffuseObjectiveButton({ cycleId, establishmentCount }: { cycleId: string; establishmentCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (establishmentCount === 0) return <p className="text-sm text-muted">Aucun établissement rattaché à ce groupe pour le moment.</p>;
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Diffuser cet objectif aux ${establishmentCount} établissement(s) rattaché(s) ? Chacun le reçoit avec un intitulé verrouillé et la définition des indicateurs ; il renseigne ses propres valeurs, mesures et actions. Une diffusion ne peut pas être retirée.`)) return;
        setBusy(true);
        const res = await callApi("POST", `/api/objectives/${cycleId}/diffuse`);
        setBusy(false);
        if (!res.ok) return alert(res.error);
        router.refresh();
      }}
    >
      Diffuser aux établissements
    </button>
  );
}
