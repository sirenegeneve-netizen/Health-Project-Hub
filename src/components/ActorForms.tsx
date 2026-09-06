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

const RACI_ROLES = ["R", "A", "C", "I"];
const RACI_LABELS: Record<string, string> = { R: "Responsible", A: "Accountable", C: "Consulted", I: "Informed" };

interface RaciCell {
  id: string;
  actorId: string;
  activite: string;
  role: string;
}

export function RaciMatrix({
  projectId,
  actors,
  entries,
}: {
  projectId: string;
  actors: { id: string; name: string }[];
  entries: RaciCell[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [activite, setActivite] = useState("");
  const [actorId, setActorId] = useState(actors[0]?.id || "");
  const [role, setRole] = useState("R");

  const activites = Array.from(new Set(entries.map((e) => e.activite)));

  async function addEntry() {
    if (!activite || !actorId) return;
    await fetch("/api/raci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, actorId, activite, role }),
    });
    setActivite("");
    setShowForm(false);
    router.refresh();
  }

  async function removeEntry(id: string) {
    await fetch(`/api/raci/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (actors.length === 0) {
    return <div className="card text-center text-ink/50 py-8">Ajoutez d'abord des acteurs pour construire la matrice RACI.</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="font-medium">Matrice RACI</div>
        {!showForm && (
          <button className="text-sm text-blue hover:underline" onClick={() => setShowForm(true)}>
            + Assigner un rôle
          </button>
        )}
      </div>

      {showForm && (
        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-ink/[0.03] rounded-lg">
          <label className="block">
            <div className="label mb-1">Activité / livrable</div>
            <input className="input w-48" value={activite} onChange={(e) => setActivite(e.target.value)} placeholder="ex. Recette laboratoire" />
          </label>
          <label className="block">
            <div className="label mb-1">Acteur</div>
            <select className="input w-40" value={actorId} onChange={(e) => setActorId(e.target.value)}>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="label mb-1">Rôle</div>
            <select className="input w-32" value={role} onChange={(e) => setRole(e.target.value)}>
              {RACI_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} — {RACI_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={addEntry}>
            Ajouter
          </button>
          <button className="btn-secondary" onClick={() => setShowForm(false)}>
            Annuler
          </button>
        </div>
      )}

      {activites.length === 0 ? (
        <div className="text-center text-ink/50 py-6 text-sm">Aucune assignation RACI pour l'instant.</div>
      ) : (
        <table className="table-hp min-w-[500px]">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-2">Activité / livrable</th>
              {actors.map((a) => (
                <th key={a.id} className="text-center">
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activites.map((act) => (
              <tr key={act}>
                <td className="pl-2 font-medium">{act}</td>
                {actors.map((a) => {
                  const cell = entries.find((e) => e.activite === act && e.actorId === a.id);
                  return (
                    <td key={a.id} className="text-center">
                      {cell ? (
                        <button
                          title={`${RACI_LABELS[cell.role]} — cliquer pour retirer`}
                          onClick={() => removeEntry(cell.id)}
                          className="w-7 h-7 rounded-full bg-primary-50 text-primary text-xs font-semibold hover:bg-bad/10 hover:text-bad"
                        >
                          {cell.role}
                        </button>
                      ) : (
                        <span className="text-ink/20">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
