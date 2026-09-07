"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { RACI_TEMPLATE, computeRaciIssues, type RaciIssue } from "@/lib/resourceGovernance";
import { AlertTriangle } from "lucide-react";

const CYCLE: (string | null)[] = ["R", "A", "C", "I", null];

const CELL_STYLE: Record<string, string> = {
  R: "bg-ok/15 text-ok",
  A: "bg-blue-50 text-blue",
  C: "bg-warn/15 text-warn",
  I: "bg-ink/10 text-ink/60",
};

const ISSUE_LABEL: Record<RaciIssue["type"], string> = {
  sans_r: "sans responsable (R)",
  sans_a: "sans décisionnaire (A)",
  plusieurs_a: "plusieurs décisionnaires (A)",
  doublon: "rôle en doublon pour un même acteur",
};

interface Actor {
  id: string;
  name: string;
}
interface Entry {
  actorId: string;
  activite: string;
  role: string;
}

export function RaciBoard({ projectId, actors, entries }: { projectId: string; actors: Actor[]; entries: Entry[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(true);

  const customActivites = Array.from(new Set(entries.map((e) => e.activite))).filter(
    (a) => !RACI_TEMPLATE.some(([, items]) => items.includes(a))
  );
  const allRows = [...RACI_TEMPLATE.flatMap(([, items]) => items), ...customActivites];
  const issues = computeRaciIssues(allRows, entries);

  async function cycle(actorId: string, activite: string, current: string | null) {
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    const key = `${actorId}:${activite}`;
    setPending(key);
    await fetch("/api/raci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, actorId, activite, role: next }),
    });
    setPending(null);
    router.refresh();
  }

  const roleAt = (actorId: string, activite: string) => entries.find((e) => e.actorId === actorId && e.activite === activite)?.role || null;

  return (
    <div>
      {entries.length > 0 && issues.length > 0 && (
        <div className="card mb-4 border-warn/20">
          <button className="flex items-center gap-2 font-medium text-sm text-warn w-full text-left" onClick={() => setShowIssues((s) => !s)}>
            <AlertTriangle size={15} />
            {issues.length} point(s) à vérifier
            <span className="ml-auto text-xs text-muted">{showIssues ? "masquer" : "afficher"}</span>
          </button>
          {showIssues && (
            <ul className="text-sm mt-3 space-y-1">
              {issues.map((iss, i) => (
                <li key={i} className="text-body">
                  <span className="font-medium">{iss.activite}</span> — {ISSUE_LABEL[iss.type]}
                  {iss.detail && <span className="text-muted"> ({iss.detail})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[520px]">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted text-[13px] border-b border-line py-2 pr-4 sticky left-0 bg-white">
                Activité / Livrable
              </th>
              {actors.map((a) => (
                <th key={a.id} className="text-center font-medium text-ink text-[13px] border-b border-line py-2 px-2 min-w-[90px]">
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RACI_TEMPLATE.map(([category, items]) => (
              <Fragment key={category}>
                <tr>
                  <td colSpan={actors.length + 1} className="pt-4 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                    {category}
                  </td>
                </tr>
                {items.map((activite) => (
                  <tr key={activite}>
                    <td className="py-1 pr-4 text-body sticky left-0 bg-white">{activite}</td>
                    {actors.map((a) => {
                      const role = roleAt(a.id, activite);
                      const key = `${a.id}:${activite}`;
                      return (
                        <td key={a.id} className="text-center p-1">
                          <button
                            onClick={() => cycle(a.id, activite, role)}
                            disabled={pending === key}
                            className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${
                              role ? CELL_STYLE[role] : "bg-ink/[0.03] text-ink/20 hover:bg-ink/[0.06]"
                            }`}
                            title={role ? `${activite} — ${a.name} : ${role}` : `Cliquer pour assigner`}
                          >
                            {role || "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
            {customActivites.length > 0 && (
              <Fragment>
                <tr>
                  <td colSpan={actors.length + 1} className="pt-4 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                    Autres
                  </td>
                </tr>
                {customActivites.map((activite) => (
                  <tr key={activite}>
                    <td className="py-1 pr-4 text-body sticky left-0 bg-white">{activite}</td>
                    {actors.map((a) => {
                      const role = roleAt(a.id, activite);
                      const key = `${a.id}:${activite}`;
                      return (
                        <td key={a.id} className="text-center p-1">
                          <button
                            onClick={() => cycle(a.id, activite, role)}
                            disabled={pending === key}
                            className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${
                              role ? CELL_STYLE[role] : "bg-ink/[0.03] text-ink/20 hover:bg-ink/[0.06]"
                            }`}
                          >
                            {role || "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>

      <NewActivityRow projectId={projectId} actors={actors} />

      <div className="flex gap-4 mt-3 text-xs text-muted">
        <span><span className="inline-block w-3 h-3 rounded bg-ok/15 align-middle mr-1" />R — Responsable</span>
        <span><span className="inline-block w-3 h-3 rounded bg-blue-50 align-middle mr-1" />A — Accountable</span>
        <span><span className="inline-block w-3 h-3 rounded bg-warn/15 align-middle mr-1" />C — Consulté</span>
        <span><span className="inline-block w-3 h-3 rounded bg-ink/10 align-middle mr-1" />I — Informé</span>
      </div>
    </div>
  );
}

function NewActivityRow({ projectId, actors }: { projectId: string; actors: Actor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (actors.length === 0) return null;

  if (!open) {
    return (
      <button className="text-sm text-blue hover:underline mt-3" onClick={() => setOpen(true)}>
        + Ajouter une activité spécifique
      </button>
    );
  }

  return (
    <div className="flex gap-2 mt-3">
      <input className="input max-w-xs" placeholder="Nom de l'activité ou du livrable" value={name} onChange={(e) => setName(e.target.value)} />
      <button
        className="btn-secondary shrink-0"
        onClick={async () => {
          if (!name.trim() || actors.length === 0) return;
          // On amorce la ligne avec un "I" sur le premier acteur, modifiable ensuite d'un clic.
          await fetch("/api/raci", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, actorId: actors[0].id, activite: name.trim(), role: "I" }),
          });
          setName("");
          setOpen(false);
          router.refresh();
        }}
      >
        Ajouter
      </button>
      <button className="btn-secondary shrink-0" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}
