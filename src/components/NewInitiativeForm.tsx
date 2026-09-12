"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  ["deploiement", "Déploiement"],
  ["evolution", "Évolution"],
  ["interoperabilite", "Interopérabilité"],
  ["migration", "Migration"],
  ["mise_a_niveau", "Mise à niveau"],
  ["cybersecurite", "Cybersécurité"],
  ["reglementaire", "Réglementaire"],
  ["formation", "Formation"],
  ["audit", "Audit"],
  ["autre", "Autre"],
];

type MethodologyItem = {
  id: string;
  kind: "risque" | "livrable" | "kpi";
  label: string;
  description: string | null;
  probabilite: string | null;
  impact: string | null;
  unit: string | null;
  categorie: string | null;
};

type MethodologyGuide = {
  finalite: string | null;
  referentiels: string[];
  items: MethodologyItem[];
};

export function NewInitiativeForm({ establishments }: { establishments: { id: string; name: string }[] }) {
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

  const [guide, setGuide] = useState<MethodologyGuide | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setGuide(null);
    setSelectedItemIds([]);
    fetch(`/api/methodology/${form.type}`)
      .then((r) => r.json())
      .then((g) => {
        if (!cancelled) setGuide(g);
      })
      .catch(() => {
        if (!cancelled) setGuide(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.type]);

  const riskItems = guide?.items.filter((i) => i.kind === "risque") || [];
  const deliverableItems = guide?.items.filter((i) => i.kind === "livrable") || [];
  const kpiItems = guide?.items.filter((i) => i.kind === "kpi") || [];

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, establishmentIds }),
    });
    const initiative = await res.json();

    const selectedRisks = riskItems.filter((i) => selectedItemIds.includes(i.id));
    const selectedDeliverables = deliverableItems.filter((i) => selectedItemIds.includes(i.id));

    await Promise.all([
      ...selectedRisks.map((i) =>
        fetch("/api/risks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initiativeId: initiative.id,
            description: i.label,
            cause: i.description || null,
            probabilite: i.probabilite || "moyenne",
            impact: i.impact || "moyen",
          }),
        })
      ),
      ...selectedDeliverables.map((i) =>
        fetch("/api/deliverables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initiativeId: initiative.id, name: i.label, description: i.description || null }),
        })
      ),
    ]);

    setSaving(false);
    router.push(`/initiatives/${initiative.id}`);
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

      {guide && (riskItems.length > 0 || deliverableItems.length > 0 || kpiItems.length > 0) && (
        <div className="border border-teal-100 rounded-xl p-4 bg-teal-50/30">
          <div className="label mb-1">Suggestions pour ce type de projet</div>
          {guide.finalite && <p className="text-xs text-ink/60 mb-3">{guide.finalite}</p>}

          {riskItems.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-ink/70 mb-1">Risques typiques à ajouter au registre</div>
              <div className="flex flex-col gap-1">
                {riskItems.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedItemIds.includes(i.id)} onChange={() => toggleItem(i.id)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {deliverableItems.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-ink/70 mb-1">Livrables typiques à prévoir</div>
              <div className="flex flex-col gap-1">
                {deliverableItems.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedItemIds.includes(i.id)} onChange={() => toggleItem(i.id)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {kpiItems.length > 0 && (
            <div>
              <div className="text-xs font-medium text-ink/70 mb-1">Indicateurs à instrumenter (à créer une fois une valeur réelle disponible)</div>
              <ul className="text-sm text-ink/60 list-disc list-inside">
                {kpiItems.map((i) => (
                  <li key={i.id}>{i.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
