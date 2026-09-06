"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES_PROJET = [
  ["chef_de_projet", "Chef de projet"],
  ["consultant", "Consultant"],
  ["consultant_fonctionnel", "Consultant fonctionnel"],
  ["consultant_interop", "Consultant interopérabilité"],
  ["expert_metier", "Expert métier"],
  ["developpeur", "Développeur"],
  ["formateur", "Formateur"],
  ["support", "Support"],
  ["expert_externe", "Expert externe"],
  ["referent_etablissement", "Référent établissement"],
];

export function ActorForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", fonction: "", organisation: "", roleProjet: "consultant", email: "", disponibiliteJh: "" });

  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        + Ajouter un acteur
      </button>
    );
  }

  return (
    <div className="card mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Nom</div>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Rôle dans le projet</div>
          <select className="input" value={f.roleProjet} onChange={(e) => setF({ ...f, roleProjet: e.target.value })}>
            {ROLES_PROJET.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Fonction</div>
          <input className="input" value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Organisation</div>
          <input className="input" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="label mb-1">Contact (email)</div>
          <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Disponibilité (JH) — optionnel</div>
          <input type="number" className="input" value={f.disponibiliteJh} onChange={(e) => setF({ ...f, disponibiliteJh: e.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="btn"
          onClick={async () => {
            if (!f.name) return;
            await fetch("/api/actors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, ...f }),
            });
            setOpen(false);
            router.refresh();
          }}
        >
          Ajouter
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}

