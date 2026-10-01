"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLE_ALLOWED_SCOPES, SCOPE_TYPE_LABELS, Role, ScopeType } from "@/lib/roles";

interface Option {
  id: string;
  name: string;
}

interface AssignmentDisplay {
  id: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string;
  scopeLabel: string;
}

export function UserDetailPanel({
  userId,
  status,
  assignments,
  groups,
  establishments,
  initiatives,
  latestInviteUrl,
}: {
  userId: string;
  status: string;
  assignments: AssignmentDisplay[];
  groups: Option[];
  establishments: Option[];
  initiatives: Option[];
  latestInviteUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState<Role>("chef_de_projet");
  const [newScopeType, setNewScopeType] = useState<ScopeType>("initiative");
  const [newScopeId, setNewScopeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState(latestInviteUrl);

  function optionsFor(scopeType: ScopeType): Option[] {
    if (scopeType === "groupe") return groups;
    if (scopeType === "etablissement") return establishments;
    if (scopeType === "initiative") return initiatives;
    return [];
  }

  async function toggleStatus() {
    setBusy(true);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "suspended" ? "active" : "suspended" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addAssignment() {
    setError(null);
    if (newScopeType !== "plateforme" && !newScopeId) {
      setError("Choisissez un périmètre.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, scopeType: newScopeType, scopeId: newScopeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'ajouter cette affectation.");
        return;
      }
      setNewScopeId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/user-assignments/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function regenerateInvite() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/invite`, { method: "POST" });
      const data = await res.json();
      setInviteUrl(data.inviteUrl);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-base text-ink">Statut du compte</h2>
          <button className="btn-secondary text-sm" disabled={busy} onClick={toggleStatus}>
            {status === "suspended" ? "Réactiver" : "Suspendre"}
          </button>
        </div>
        {status === "invited" && (
          <div className="mt-2">
            <p className="text-sm text-muted mb-2">Compte invité, pas encore activé.</p>
            {inviteUrl ? (
              <div className="flex gap-2">
                <input readOnly className="input flex-1 text-xs" value={inviteUrl} onFocus={(e) => e.target.select()} />
                <button className="btn-secondary text-sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                  Copier
                </button>
              </div>
            ) : (
              <button className="btn-secondary text-sm" disabled={busy} onClick={regenerateInvite}>
                Générer un lien d'invitation
              </button>
            )}
            <button className="text-xs text-blue hover:underline mt-2 block" disabled={busy} onClick={regenerateInvite}>
              Régénérer un nouveau lien (invalide l'ancien)
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-display text-base text-ink mb-3">Rôles HPH / périmètres</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted mb-3">Aucune affectation.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium text-ink">{ROLE_LABELS[a.role]}</span> — {SCOPE_TYPE_LABELS[a.scopeType]} : {a.scopeLabel}
                </span>
                <button className="text-ink/40 hover:text-bad text-xs" disabled={busy} onClick={() => removeAssignment(a.id)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="input"
            value={newRole}
            onChange={(e) => {
              const role = e.target.value as Role;
              setNewRole(role);
              setNewScopeType(ROLE_ALLOWED_SCOPES[role][0]);
              setNewScopeId("");
            }}
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select className="input" value={newScopeType} onChange={(e) => setNewScopeType(e.target.value as ScopeType)}>
            {ROLE_ALLOWED_SCOPES[newRole].map((st) => (
              <option key={st} value={st}>
                {SCOPE_TYPE_LABELS[st]}
              </option>
            ))}
          </select>
          {newScopeType !== "plateforme" && (
            <select className="input flex-1" value={newScopeId} onChange={(e) => setNewScopeId(e.target.value)}>
              <option value="">— Choisir —</option>
              {optionsFor(newScopeType).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn-secondary text-sm" disabled={busy} onClick={addAssignment}>
            + Ajouter
          </button>
        </div>
        {error && <p className="text-sm text-bad mt-2">{error}</p>}
      </div>
    </div>
  );
}
