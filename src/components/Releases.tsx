"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineSelect } from "@/components/InlineSelect";

const STATUS_OPTIONS = [
  { value: "planifiee", label: "Planifiée" },
  { value: "deployee", label: "Déployée" },
  { value: "annulee", label: "Annulée" },
];

interface Release {
  id: string;
  version: string;
  contenu: string | null;
  status: string;
  dateDeploiement: string | null;
  changeRequests: { id: string; titre: string }[];
}

export function Releases({ initiativeId, releases }: { initiativeId: string; releases: Release[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ version: "", contenu: "", dateDeploiement: "" });

  async function create() {
    if (!f.version) return;
    await fetch("/api/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, initiativeId }),
    });
    setF({ version: "", contenu: "", dateDeploiement: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Releases</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Planifier une release
          </button>
        )}
      </div>

      {releases.length === 0 ? (
        <p className="text-sm text-ink/40">Aucune release planifiée.</p>
      ) : (
        <ul className="space-y-2">
          {releases.map((r) => (
            <li key={r.id} className="border-b border-line/60 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {r.version}
                  {r.dateDeploiement && <span className="text-ink/40 font-normal"> — {new Date(r.dateDeploiement).toLocaleDateString("fr-FR")}</span>}
                </div>
                <InlineSelect endpoint={`/api/releases/${r.id}`} field="status" value={r.status} options={STATUS_OPTIONS} />
              </div>
              {r.contenu && <p className="text-xs text-ink/50 mt-1">{r.contenu}</p>}
              {r.changeRequests.length > 0 && (
                <p className="text-xs text-ink/40 mt-1">Changements inclus : {r.changeRequests.map((c) => c.titre).join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Version (ex. 2.4.0)" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
            <input className="input" type="date" value={f.dateDeploiement} onChange={(e) => setF({ ...f, dateDeploiement: e.target.value })} />
          </div>
          <textarea className="input" placeholder="Contenu / notes de version" value={f.contenu} onChange={(e) => setF({ ...f, contenu: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn" onClick={create}>
              Planifier
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
