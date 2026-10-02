"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLE_ALLOWED_SCOPES, SCOPE_TYPE_LABELS, Role, ScopeType } from "@/lib/roles";

interface Option {
  id: string;
  name: string;
  groupId?: string;
}

interface AssignmentRow {
  role: Role;
  scopeType: ScopeType;
  scopeId: string;
}

export function UserCreateForm({
  actors,
  groups,
  establishments,
  initiatives,
}: {
  actors: { id: string; name: string; fonction: string | null }[];
  groups: Option[];
  establishments: Option[];
  initiatives: Option[];
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState({ name: "", email: "", telephone: "" });
  const [actorMode, setActorMode] = useState<"existing" | "new" | "none">("none");
  const [actorId, setActorId] = useState("");
  const [actorFonction, setActorFonction] = useState("");
  const [rows, setRows] = useState<AssignmentRow[]>([{ role: "chef_de_projet", scopeType: "groupe", scopeId: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function optionsFor(scopeType: ScopeType): Option[] {
    if (scopeType === "groupe") return groups;
    if (scopeType === "etablissement") return establishments;
    if (scopeType === "initiative") return initiatives;
    return [];
  }

  function updateRow(i: number, patch: Partial<AssignmentRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setError(null);
    if (!identity.name || !identity.email) {
      setError("Nom et email sont requis.");
      return;
    }
    const incomplete = rows.some((r) => r.scopeType !== "plateforme" && !r.scopeId);
    if (incomplete) {
      setError("Choisissez un périmètre pour chaque affectation (ou supprimez la ligne avec ×).");
      return;
    }
    const assignments = rows;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...identity,
          actorId: actorMode === "existing" ? actorId : undefined,
          actorFonction: actorMode === "new" ? actorFonction : undefined,
          assignments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Création impossible.");
        return;
      }
      setInviteUrl(data.inviteUrl);
    } finally {
      setLoading(false);
    }
  }

  if (inviteUrl) {
    return (
      <div className="card max-w-xl">
        <p className="text-sm text-ink font-medium mb-2">Compte créé.</p>
        <p className="text-sm text-muted mb-3">
          Transmettez ce lien d'invitation à {identity.name} pour qu'il/elle définisse son mot de passe et active son compte. Le lien est valable 7
          jours.
        </p>
        <div className="flex gap-2">
          <input readOnly className="input flex-1 text-xs" value={inviteUrl} onFocus={(e) => e.target.select()} />
          <button className="btn-secondary text-sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copier
          </button>
        </div>
        <button className="btn mt-4" onClick={() => router.push("/admin/users")}>
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="font-display text-base text-ink mb-3">Identité</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Nom complet</label>
            <input className="input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1">Email</label>
            <input type="email" className="input" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
          </div>
          <div>
            <label className="label block mb-1">Téléphone (optionnel)</label>
            <input className="input" value={identity.telephone} onChange={(e) => setIdentity({ ...identity, telephone: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-base text-ink mb-1">Fonction dans l'organisation</h2>
        <p className="text-sm text-muted mb-3">Indépendante du rôle HPH défini plus bas.</p>
        <div className="flex gap-4 mb-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={actorMode === "none"} onChange={() => setActorMode("none")} /> Aucune pour l'instant
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={actorMode === "existing"} onChange={() => setActorMode("existing")} /> Rattacher à un Acteur existant
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={actorMode === "new"} onChange={() => setActorMode("new")} /> Créer un nouvel Acteur
          </label>
        </div>
        {actorMode === "existing" && (
          <select className="input" value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">— Choisir —</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.fonction ? ` — ${a.fonction}` : ""}
              </option>
            ))}
          </select>
        )}
        {actorMode === "new" && (
          <input className="input" placeholder="Fonction (ex. Responsable qualité)" value={actorFonction} onChange={(e) => setActorFonction(e.target.value)} />
        )}
      </div>

      <div className="card">
        <h2 className="font-display text-base text-ink mb-1">Accès HPH</h2>
        <p className="text-sm text-muted mb-3">Un ou plusieurs rôles, chacun rattaché à un périmètre.</p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                className="input"
                value={row.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  updateRow(i, { role, scopeType: ROLE_ALLOWED_SCOPES[role][0], scopeId: "" });
                }}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={row.scopeType}
                onChange={(e) => updateRow(i, { scopeType: e.target.value as ScopeType, scopeId: "" })}
              >
                {ROLE_ALLOWED_SCOPES[row.role].map((st) => (
                  <option key={st} value={st}>
                    {SCOPE_TYPE_LABELS[st]}
                  </option>
                ))}
              </select>
              {row.scopeType !== "plateforme" && (
                <select className="input flex-1" value={row.scopeId} onChange={(e) => updateRow(i, { scopeId: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {optionsFor(row.scopeType).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="text-ink/40 hover:text-bad text-sm px-2" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary text-sm mt-3"
          onClick={() => setRows((r) => [...r, { role: "chef_de_projet", scopeType: "groupe", scopeId: "" }])}
        >
          + Ajouter une affectation
        </button>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn" disabled={loading} onClick={submit}>
        {loading ? "Création…" : "Créer le compte et générer l'invitation"}
      </button>
    </div>
  );
}
