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

export function ActorManageRow({
  actor,
  roleLabels,
}: {
  actor: {
    id: string;
    name: string;
    actif: boolean;
    roleProjet: string | null;
    fonction: string | null;
    organisation: string | null;
    email: string | null;
    telephone: string | null;
    disponibiliteJh: number | null;
    competences: string | null;
  };
  roleLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: actor.name,
    fonction: actor.fonction || "",
    organisation: actor.organisation || "",
    roleProjet: actor.roleProjet || "consultant",
    email: actor.email || "",
    telephone: actor.telephone || "",
    disponibiliteJh: actor.disponibiliteJh !== null ? String(actor.disponibiliteJh) : "",
  });

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/actors/${actor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className={actor.actif ? "" : "opacity-60"}>
        <td className="pl-4" colSpan={8}>
          <div className="grid grid-cols-2 gap-3 py-2">
            <label className="block">
              <div className="label mb-1">Nom</div>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Rôle dans l'initiative</div>
              <select className="input" value={f.roleProjet} onChange={(e) => setF({ ...f, roleProjet: e.target.value })}>
                {ROLES_PROJET.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="label mb-1">Fonction</div>
              <input className="input" value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Organisation</div>
              <input className="input" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Contact (email)</div>
              <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Téléphone</div>
              <input className="input" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Disponibilité (JH) — optionnel</div>
              <input
                type="number"
                className="input"
                value={f.disponibiliteJh}
                onChange={(e) => setF({ ...f, disponibiliteJh: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2 pb-2">
            <button
              className="btn"
              disabled={busy || !f.name}
              onClick={async () => {
                await patch({
                  name: f.name,
                  fonction: f.fonction || null,
                  organisation: f.organisation || null,
                  roleProjet: f.roleProjet,
                  email: f.email || null,
                  telephone: f.telephone || null,
                  disponibiliteJh: f.disponibiliteJh || null,
                });
                setEditing(false);
              }}
            >
              Enregistrer
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={actor.actif ? "" : "opacity-60"}>
      <td className="pl-4 font-medium">{actor.name}</td>
      <td>{actor.roleProjet ? roleLabels[actor.roleProjet] || actor.roleProjet : "—"}</td>
      <td>{actor.fonction || "—"}</td>
      <td>{actor.organisation || "—"}</td>
      <td className="text-sm">{actor.email || "—"}</td>
      <td>{actor.disponibiliteJh !== null ? `${actor.disponibiliteJh} JH` : "—"}</td>
      <td>
        <span className={actor.actif ? "text-good text-sm" : "text-muted text-sm"}>{actor.actif ? "Actif" : "Inactif"}</span>
      </td>
      <td className="pr-4 text-right whitespace-nowrap">
        <button className="btn-secondary text-xs mr-2" onClick={() => setEditing(true)}>
          Modifier
        </button>
        <button className="btn-secondary text-xs" disabled={busy} onClick={() => patch({ actif: !actor.actif })}>
          {actor.actif ? "Désactiver" : "Réactiver"}
        </button>
      </td>
    </tr>
  );
}

export function ActorForm({ initiativeId }: { initiativeId: string }) {
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
          <div className="label mb-1">Rôle dans l'initiative</div>
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
              body: JSON.stringify({ initiativeId, ...f }),
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

