"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["deploiement", "Déploiement"],
  ["migration", "Migration"],
  ["evolution", "Évolution"],
  ["interoperabilite", "Interopérabilité"],
  ["changement_version", "Changement de version"],
  ["remplacement", "Remplacement de solution"],
  ["mise_en_conformite", "Mise en conformité"],
  ["optimisation", "Optimisation"],
  ["autre", "Autre"],
];

export function NewProjectForm({ establishments }: { establishments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    name: "",
    description: "",
    type: "deploiement",
    chefDeProjet: "",
    sponsor: "",
    startDate: "",
    targetDate: "",
    priority: "normale",
    budgetJh: "",
    budgetInitialEur: "",
  });
  const [establishmentIds, setEstablishmentIds] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, establishmentIds }),
    });
    const project = await res.json();
    setSaving(false);
    router.push(`/projects/${project.id}`);
  }

  return (
    <form onSubmit={submit} className="card space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Référence">
          <input required className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field label="Nom du projet">
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>

      <Field label="Description">
        <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priorité">
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="basse">Basse</option>
            <option value="normale">Normale</option>
            <option value="haute">Haute</option>
            <option value="critique">Critique</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Chef de projet">
          <input className="input" value={form.chefDeProjet} onChange={(e) => setForm({ ...form, chefDeProjet: e.target.value })} />
        </Field>
        <Field label="Sponsor">
          <input className="input" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Date de début">
          <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="Date cible">
          <input type="date" className="input" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        </Field>
        <Field label="Budget JH">
          <input type="number" className="input" value={form.budgetJh} onChange={(e) => setForm({ ...form, budgetJh: e.target.value })} />
        </Field>
        <Field label="Budget (€) — optionnel">
          <input type="number" className="input" value={form.budgetInitialEur} onChange={(e) => setForm({ ...form, budgetInitialEur: e.target.value })} />
        </Field>
      </div>

      <Field label="Établissement(s) concerné(s)">
        <div className="flex flex-wrap gap-2">
          {establishments.map((e) => (
            <label key={e.id} className="flex items-center gap-1.5 text-sm border border-teal-100 rounded px-2 py-1">
              <input
                type="checkbox"
                checked={establishmentIds.includes(e.id)}
                onChange={(ev) =>
                  setEstablishmentIds((prev) => (ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)))
                }
              />
              {e.name}
            </label>
          ))}
          {establishments.length === 0 && <span className="text-sm text-ink/50">Aucun établissement enregistré pour l'instant.</span>}
        </div>
      </Field>

      <button className="btn" disabled={saving} type="submit">
        {saving ? "Création…" : "Créer le projet"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      {children}
    </label>
  );
}
