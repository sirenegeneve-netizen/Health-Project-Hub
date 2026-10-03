"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { callApi } from "./api";

export interface EditorCriterion {
  id: string;
  label: string;
  obligatoire: boolean;
}

export interface EditorStage {
  id: string;
  key: string;
  label: string;
  objectif: string | null;
  obligatoire: boolean;
  active: boolean;
  criteria: EditorCriterion[];
}

export interface EditorTemplate {
  id: string;
  name: string;
  version: number;
  status: string;
  isGeneral: boolean;
  typeLabel: string;
  initiativeCount: number;
  stages: EditorStage[];
}

const STATUS: Record<string, { text: string; tone: "ok" | "warn" | "neutral" }> = {
  actif: { text: "Actif", tone: "ok" },
  brouillon: { text: "Brouillon", tone: "warn" },
  archive: { text: "Archivé", tone: "neutral" },
};

// Éditeur de parcours : timeline verticale des étapes + configuration détaillée « Modèle × Étape ».
// `locked` = modèle utilisé par des initiatives (ou archivé) : lecture seule, on crée une nouvelle version.
export function TemplateEditor({ template, library, locked }: { template: EditorTemplate; library: { key: string; label: string }[]; locked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [libraryKey, setLibraryKey] = useState("");
  const [freeLabel, setFreeLabel] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string; data?: any }>, after?: (data: any) => void) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (after) after(res.data);
    else router.refresh();
  }

  const st = STATUS[template.status] || STATUS.brouillon;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="text-xs text-ink/45 mb-1">{template.isGeneral ? "Modèle général" : template.typeLabel}</div>
          <h1 className="font-display text-2xl text-ink flex items-center gap-3 flex-wrap">
            {template.name} <span className="text-ink/40 text-lg">V{template.version}</span>
            <Pill text={st.text} tone={st.tone} />
          </h1>
          <div className="text-sm text-muted mt-1">
            {template.initiativeCount} initiative{template.initiativeCount > 1 ? "s" : ""} rattachée{template.initiativeCount > 1 ? "s" : ""} à cette version
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              const next = prompt("Nom du modèle :", template.name);
              if (next && next.trim() && next !== template.name) run(() => callApi("PATCH", `/api/project-templates/${template.id}`, { name: next }));
            }}
          >
            Renommer
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => run(() => callApi("PATCH", `/api/project-templates/${template.id}`, { action: "new_version" }), (d) => router.push(`/settings/projects/templates/${d.id}`))}
          >
            Nouvelle version
          </button>
          {template.status !== "actif" && (
            <button className="btn" disabled={busy} onClick={() => run(() => callApi("PATCH", `/api/project-templates/${template.id}`, { action: "activate" }))}>
              Activer cette version
            </button>
          )}
          {template.status === "actif" && !template.isGeneral && (
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                if (confirm("Archiver ce modèle ? Il ne sera plus proposé aux nouvelles initiatives ; les initiatives existantes ne changent pas.")) run(() => callApi("PATCH", `/api/project-templates/${template.id}`, { action: "archive" }));
              }}
            >
              Archiver
            </button>
          )}
        </div>
      </div>

      {locked && (
        <div className="card border-warn/40 bg-warn/5 mb-6 text-sm text-body">
          {template.initiativeCount > 0
            ? "Ce modèle est utilisé par des initiatives : pour préserver leur parcours, il n'est pas modifiable. Créez une nouvelle version, puis activez-la — les initiatives existantes restent sur cette version, les nouvelles utiliseront la version active."
            : "Ce modèle est archivé : créez une nouvelle version pour le modifier."}
        </div>
      )}

      <div className="max-w-2xl">
        {template.stages.length === 0 && <div className="card text-center text-ink/50 py-8">Parcours vide — ajoutez une première étape ci-dessous.</div>}

        {template.stages.map((s, i) => {
          const open = openId === s.id;
          return (
            <div key={s.id}>
              <div className={`card !p-0 ${s.active ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary-50 text-primary text-xs flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink flex items-center gap-2 flex-wrap">
                        {s.label}
                        {!s.obligatoire && <Pill text="Optionnelle" tone="neutral" />}
                        {!s.active && <Pill text="Inactive" tone="warn" />}
                      </div>
                      <div className="text-xs text-ink/45">
                        {s.criteria.length} critère{s.criteria.length > 1 ? "s" : ""} de passage
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    <button title="Monter" className="px-1 text-ink/60 hover:text-ink disabled:opacity-30" disabled={locked || busy || i === 0} onClick={() => run(() => callApi("PATCH", `/api/template-stages/${s.id}`, { move: "up" }))}>
                      ↑
                    </button>
                    <button title="Descendre" className="px-1 text-ink/60 hover:text-ink disabled:opacity-30" disabled={locked || busy || i === template.stages.length - 1} onClick={() => run(() => callApi("PATCH", `/api/template-stages/${s.id}`, { move: "down" }))}>
                      ↓
                    </button>
                    <button className="text-blue hover:underline" onClick={() => setOpenId(open ? null : s.id)}>
                      {open ? "Fermer" : "Configurer"}
                    </button>
                  </div>
                </div>

                {open && (
                  <StageConfig stage={s} locked={locked} busy={busy} run={run} onChanged={() => router.refresh()} />
                )}
              </div>
              {i < template.stages.length - 1 && <div className="text-center text-ink/30 leading-none py-1.5">↓</div>}
            </div>
          );
        })}

        {!locked && (
          <div className="card mt-6">
            <div className="label mb-2">+ Ajouter une étape</div>
            <div className="flex flex-wrap gap-2 items-center">
              <select className="input w-64" value={libraryKey} onChange={(e) => setLibraryKey(e.target.value)}>
                <option value="">Depuis la bibliothèque…</option>
                {library.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                disabled={busy || !libraryKey}
                onClick={() => run(() => callApi("POST", `/api/project-templates/${template.id}/stages`, { stageDefKey: libraryKey }), () => { setLibraryKey(""); router.refresh(); })}
              >
                Ajouter
              </button>
              <span className="text-sm text-ink/40">ou</span>
              <input className="input w-56" placeholder="Nouvelle étape libre" value={freeLabel} onChange={(e) => setFreeLabel(e.target.value)} />
              <button
                className="btn-secondary"
                disabled={busy || !freeLabel.trim()}
                onClick={() => run(() => callApi("POST", `/api/project-templates/${template.id}/stages`, { label: freeLabel }), () => { setFreeLabel(""); router.refresh(); })}
              >
                Ajouter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StageConfig({
  stage,
  locked,
  busy,
  run,
  onChanged,
}: {
  stage: EditorStage;
  locked: boolean;
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; data?: any }>, after?: (data: any) => void) => Promise<void>;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(stage.label);
  const [objectif, setObjectif] = useState(stage.objectif || "");
  const [newCriterion, setNewCriterion] = useState("");

  const dirty = label !== stage.label || objectif !== (stage.objectif || "");

  return (
    <div className="border-t border-ink/5 px-4 py-4 space-y-4">
      <div className="grid gap-3">
        <label className="block">
          <div className="label mb-1">Nom de l'étape</div>
          <input className="input" disabled={locked} value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block">
          <div className="label mb-1">Objectif</div>
          <textarea className="input" rows={2} disabled={locked} value={objectif} onChange={(e) => setObjectif(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" disabled={locked || busy} checked={stage.obligatoire} onChange={(e) => run(() => callApi("PATCH", `/api/template-stages/${stage.id}`, { obligatoire: e.target.checked }))} />
            Étape obligatoire
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" disabled={locked || busy} checked={stage.active} onChange={(e) => run(() => callApi("PATCH", `/api/template-stages/${stage.id}`, { active: e.target.checked }))} />
            Active dans le parcours
          </label>
          {!locked && (
            <>
              <button className="text-blue hover:underline" disabled={busy} onClick={() => run(() => callApi("POST", `/api/template-stages/${stage.id}`, {}))}>
                Dupliquer l'étape
              </button>
              <button
                className="text-bad hover:underline"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Retirer « ${stage.label} » du parcours ? Les initiatives existantes ne sont pas modifiées.`)) run(() => callApi("DELETE", `/api/template-stages/${stage.id}`));
                }}
              >
                Retirer du parcours
              </button>
            </>
          )}
        </div>
        {!locked && dirty && (
          <div>
            <button className="btn" disabled={busy || !label.trim()} onClick={() => run(() => callApi("PATCH", `/api/template-stages/${stage.id}`, { label, objectif }))}>
              Enregistrer l'étape
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="label mb-2">Critères de passage</div>
        <ul className="divide-y divide-ink/5">
          {stage.criteria.map((c) => (
            <CriterionRow key={c.id} criterion={c} locked={locked} busy={busy} run={run} />
          ))}
          {stage.criteria.length === 0 && <li className="text-sm text-ink/45 py-2">Aucun critère : cette étape n'a pas de condition de passage.</li>}
        </ul>
        {!locked && (
          <form
            className="flex gap-2 mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCriterion.trim()) return;
              run(() => callApi("POST", `/api/template-stages/${stage.id}/criteria`, { label: newCriterion }), () => {
                setNewCriterion("");
                onChanged();
              });
            }}
          >
            <input className="input" placeholder="Nouveau critère" value={newCriterion} onChange={(e) => setNewCriterion(e.target.value)} />
            <button className="btn-secondary" disabled={busy || !newCriterion.trim()} type="submit">
              Ajouter
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-ink/40">Livrables, rôles, risques types, décisions, indicateurs et Gates : prochain lot.</p>
    </div>
  );
}

function CriterionRow({
  criterion,
  locked,
  busy,
  run,
}: {
  criterion: EditorCriterion;
  locked: boolean;
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string; data?: any }>) => Promise<void>;
}) {
  const [label, setLabel] = useState(criterion.label);
  return (
    <li className="flex items-center gap-3 py-2">
      <input
        className="input"
        disabled={locked}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label.trim() && label !== criterion.label) run(() => callApi("PATCH", `/api/template-stage-criteria/${criterion.id}`, { label }));
          else setLabel(criterion.label);
        }}
      />
      <label className="flex items-center gap-1.5 text-xs text-ink/60 shrink-0">
        <input type="checkbox" disabled={locked || busy} checked={criterion.obligatoire} onChange={(e) => run(() => callApi("PATCH", `/api/template-stage-criteria/${criterion.id}`, { obligatoire: e.target.checked }))} />
        Obligatoire
      </label>
      {!locked && (
        <button className="text-bad text-sm hover:underline shrink-0" disabled={busy} onClick={() => run(() => callApi("DELETE", `/api/template-stage-criteria/${criterion.id}`))}>
          Retirer
        </button>
      )}
    </li>
  );
}
