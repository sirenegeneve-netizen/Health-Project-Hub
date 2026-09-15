"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES_CONTACT = [
  ["direction", "Direction"],
  ["direction_medicale", "Direction médicale"],
  ["referent_metier", "Référent métier"],
  ["referent_informatique", "Référent informatique"],
  ["referent_qualite", "Référent qualité"],
  ["chef_de_projet_client", "Chef de projet client"],
  ["autre", "Autre"],
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES_CONTACT);

interface ExistingActor {
  id: string;
  name: string;
}

interface Affiliation {
  id: string;
  role: string | null;
  actor: { id: string; name: string; fonction: string | null; email: string | null };
}

export function GroupContacts({
  groupId,
  affiliations,
  existingActors,
}: {
  groupId: string;
  affiliations: Affiliation[];
  existingActors: ExistingActor[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "new" | "existing">("none");
  const [role, setRole] = useState("referent_informatique");
  const [newActor, setNewActor] = useState({ name: "", fonction: "", email: "" });
  const [pickedActorId, setPickedActorId] = useState("");

  async function createNew() {
    if (!newActor.name) return;
    await fetch("/api/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newActor,
        affiliation: { groupId, role },
      }),
    });
    setNewActor({ name: "", fonction: "", email: "" });
    setMode("none");
    router.refresh();
  }

  async function attachExisting() {
    if (!pickedActorId) return;
    await fetch("/api/actor-affiliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: pickedActorId, groupId, role }),
    });
    setPickedActorId("");
    setMode("none");
    router.refresh();
  }

  async function removeAffiliation(id: string) {
    await fetch(`/api/actor-affiliations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink">Contacts</h3>
        {mode === "none" && (
          <div className="flex gap-2 text-sm">
            <button className="btn-secondary" onClick={() => setMode("existing")}>
              + Depuis le référentiel
            </button>
            <button className="btn" onClick={() => setMode("new")}>
              + Nouveau contact
            </button>
          </div>
        )}
      </div>

      {affiliations.length === 0 ? (
        <p className="text-sm text-ink/40 mb-2">Aucun contact rattaché.</p>
      ) : (
        <ul className="space-y-2 mb-2">
          {affiliations.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
              <div>
                <span className="font-medium">{a.actor.name}</span>
                {a.actor.fonction && <span className="text-ink/50"> — {a.actor.fonction}</span>}
                {a.role && <span className="ml-2 text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{ROLE_LABELS[a.role] || a.role}</span>}
              </div>
              <button className="text-xs text-red-500 hover:underline" onClick={() => removeAffiliation(a.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "new" && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Nom" value={newActor.name} onChange={(e) => setNewActor({ ...newActor, name: e.target.value })} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES_CONTACT.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Fonction" value={newActor.fonction} onChange={(e) => setNewActor({ ...newActor, fonction: e.target.value })} />
            <input className="input" placeholder="Email" value={newActor.email} onChange={(e) => setNewActor({ ...newActor, email: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={createNew}>
              Ajouter
            </button>
            <button className="btn-secondary" onClick={() => setMode("none")}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === "existing" && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={pickedActorId} onChange={(e) => setPickedActorId(e.target.value)}>
              <option value="">— Choisir un acteur —</option>
              {existingActors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES_CONTACT.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={attachExisting}>
              Rattacher
            </button>
            <button className="btn-secondary" onClick={() => setMode("none")}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
