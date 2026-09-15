"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  version: string | null;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  en_projet: "En projet",
  desactive: "Désactivé",
};

export function InstalledProducts({ establishmentId, products }: { establishmentId: string; products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", version: "", status: "actif" });

  async function create() {
    if (!f.name) return;
    await fetch("/api/installed-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, establishmentId }),
    });
    setF({ name: "", version: "", status: "actif" });
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/installed-products/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Produits installés</h3>
        {!open && (
          <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
            + Ajouter
          </button>
        )}
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-ink/40">Aucun produit renseigné.</p>
      ) : (
        <ul className="space-y-1.5">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
              <div>
                <span className="font-medium">{p.name}</span>
                {p.version && <span className="text-ink/50"> — v{p.version}</span>}
                <span className="ml-2 text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{STATUS_LABELS[p.status] || p.status}</span>
              </div>
              <button className="text-xs text-red-500 hover:underline" onClick={() => remove(p.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Nom du produit" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input" placeholder="Version" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
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
