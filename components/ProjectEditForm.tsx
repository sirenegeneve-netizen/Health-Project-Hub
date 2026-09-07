"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  status: string;
  phase: string;
  priority: string;
  targetDate: string | null;
  budgetJh: number;
  jhPlanifies: number;
  jhConsommes: number;
  chefDeProjet: string | null;
  sponsor: string | null;
};

const PHASES = [
  "opportunite", "qualification", "cadrage", "kick_off", "analyse_ecosysteme", "recueil_besoins",
  "analyse_ecarts", "conception", "parametrage", "interoperabilite", "migration", "tests", "formation",
  "preparation_go_no_go", "go_no_go", "deploiement", "hypercare", "stabilisation", "run",
  "amelioration_continue", "cloture", "retex",
];

export function ProjectEditForm({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: project.status,
    phase: project.phase,
    priority: project.priority,
    targetDate: project.targetDate ? project.targetDate.slice(0, 10) : "",
    planningChangeReason: "",
    budgetJh: String(project.budgetJh),
    jhPlanifies: String(project.jhPlanifies),
    jhConsommes: String(project.jhConsommes),
    chefDeProjet: project.chefDeProjet || "",
    sponsor: project.sponsor || "",
  });

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Mettre à jour le projet
      </button>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Statut">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="actif">Actif</option>
            <option value="en_pause">En pause</option>
            <option value="cloture">Clôturé</option>
          </select>
        </Field>
        <Field label="Phase">
          <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
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
        <Field label="Date cible">
          <input type="date" className="input" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        </Field>
      </div>

      <Field label="Motif du changement de date (si applicable — crée une nouvelle baseline)">
        <input className="input" value={form.planningChangeReason} onChange={(e) => setForm({ ...form, planningChangeReason: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Chef de projet">
          <input className="input" value={form.chefDeProjet} onChange={(e) => setForm({ ...form, chefDeProjet: e.target.value })} />
        </Field>
        <Field label="Sponsor">
          <input className="input" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} />
        </Field>
        <Field label="JH budgétés">
          <input type="number" className="input" value={form.budgetJh} onChange={(e) => setForm({ ...form, budgetJh: e.target.value })} />
        </Field>
        <Field label="JH consommés">
          <input type="number" className="input" value={form.jhConsommes} onChange={(e) => setForm({ ...form, jhConsommes: e.target.value })} />
        </Field>
      </div>

      <div className="flex gap-2">
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
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
