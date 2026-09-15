"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Iface {
  id: string;
  type: string;
  editeurTiers: string | null;
  status: string;
}

const TYPES = [
  ["laboratoire", "Laboratoire"],
  ["ris", "RIS"],
  ["pacs", "PACS"],
  ["erp", "ERP"],
  ["sirh", "SIRH"],
  ["pmsi", "PMSI"],
  ["mssante", "MSSanté"],
  ["dmp", "DMP"],
  ["autre", "Autre"],
];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES);

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  en_projet: "En projet",
  desactivee: "Désactivée",
};

export function EcosystemInterfaces({ establishmentId, interfaces }: { establishmentId: string; interfaces: Iface[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "laboratoire", editeurTiers: "", status: "active" });

  async function create() {
    await fetch("/api/establishment-interfaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, establishmentId }),
    });
    setF({ type: "laboratoire", editeurTiers: "", status: "active" });
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/establishment-interfaces/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Écosystème d'interfaces</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Ajouter
          </button>
        )}
      </div>
      {interfaces.length === 0 ? (
        <p className="text-sm text-ink/40">Aucune interface renseignée.</p>
      ) : (
        <ul className="space-y-1.5">
          {interfaces.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
              <div>
                <span className="font-medium">{TYPE_LABELS[i.type] || i.type}</span>
                {i.editeurTiers && <span className="text-ink/50"> — {i.editeurTiers}</span>}
                <span className="ml-2 text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{STATUS_LABELS[i.status] || i.status}</span>
              </div>
              <button className="text-xs text-red-500 hover:underline" onClick={() => remove(i.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-3 gap-2">
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Éditeur tiers" value={f.editeurTiers} onChange={(e) => setF({ ...f, editeurTiers: e.target.value })} />
            <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={create}>
              Ajouter
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
