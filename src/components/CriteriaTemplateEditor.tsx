"use client";

import { useEffect, useState } from "react";

const STAGES: { key: string; label: string }[] = [
  { key: "kickoff", label: "Kick-off" },
  { key: "preparation", label: "Préparation" },
  { key: "cloture", label: "Clôture" },
];

const PROJECT_TYPES: { key: string; label: string }[] = [
  { key: "defaut", label: "Modèle par défaut" },
  { key: "deploiement", label: "Déploiement" },
  { key: "migration", label: "Migration" },
  { key: "evolution", label: "Évolution" },
  { key: "interoperabilite", label: "Interopérabilité" },
  { key: "changement_version", label: "Changement de version" },
  { key: "remplacement", label: "Remplacement" },
  { key: "mise_en_conformite", label: "Mise en conformité" },
  { key: "optimisation", label: "Optimisation" },
  { key: "autre", label: "Autre" },
];

interface Template {
  id: string;
  label: string;
}

// Édition des checklists par étape, par type de projet (§17 : « checklists
// configurables par type de projet »). Un type sans personnalisation reste
// vide ici — les projets de ce type utilisent alors le modèle par défaut
// (voir ensureStageCriteria côté serveur).
export function CriteriaTemplateEditor() {
  const [stageKey, setStageKey] = useState(STAGES[0].key);
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0].key);
  const [items, setItems] = useState<Template[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/stage-criteria-templates?stageKey=${stageKey}&projectType=${projectType}`);
    setItems(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey, projectType]);

  async function add() {
    if (!newLabel.trim()) return;
    await fetch("/api/stage-criteria-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectType, stageKey, label: newLabel.trim() }),
    });
    setNewLabel("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/stage-criteria-templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card">
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <div className="label mb-1">Étape</div>
          <div className="flex gap-1">
            {STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStageKey(s.key)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  stageKey === s.key ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1">Type de projet</div>
          <select className="input" value={projectType} onChange={(e) => setProjectType(e.target.value)}>
            {PROJECT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {projectType !== "defaut" && items.length === 0 && !loading && (
        <p className="text-sm text-ink/50 mb-3">
          Ce type de projet n'a pas de liste dédiée pour cette étape — les projets de ce type utilisent le modèle par
          défaut. Ajouter un critère ci-dessous crée une liste propre à ce type.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : (
        <ul className="divide-y divide-ink/5 mb-4">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-body">{it.label}</span>
              <button onClick={() => remove(it.id)} className="text-xs text-bad hover:underline shrink-0">
                Retirer
              </button>
            </li>
          ))}
          {items.length === 0 && projectType === "defaut" && <li className="py-2 text-sm text-muted">Aucun critère — ajoutez-en un ci-dessous.</li>}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Nouveau critère…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className="btn-secondary text-sm">
          Ajouter
        </button>
      </div>
    </div>
  );
}
