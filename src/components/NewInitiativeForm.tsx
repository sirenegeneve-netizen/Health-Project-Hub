"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Repli si le référentiel de types n'est pas encore chargé en base (avant la migration des modèles).
const FALLBACK_TYPES: ProjectTypeOption[] = [
  ["deploiement", "Déploiement"],
  ["evolution", "Évolution"],
  ["interoperabilite", "Interopérabilité"],
  ["migration", "Migration"],
  ["mise_a_niveau", "Mise à niveau"],
  ["cybersecurite", "Cybersécurité"],
  ["reglementaire", "Réglementaire"],
  ["formation", "Formation"],
  ["audit", "Audit"],
  ["autre", "Personnalisé"],
].map(([key, label]) => ({ key, label, family: "" }));

interface ProjectTypeOption {
  key: string;
  label: string;
  family: string;
}

interface TemplateOption {
  id: string;
  name: string;
  version: number;
}

export function NewInitiativeForm({
  groups,
  establishments,
}: {
  groups: { id: string; name: string }[];
  establishments: { id: string; name: string; groupId: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
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
  const [types, setTypes] = useState<ProjectTypeOption[]>(FALLBACK_TYPES);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [fallbackGeneral, setFallbackGeneral] = useState(false);

  // Types disponibles : référentiel en base (actifs, non archivés), sinon repli historique.
  useEffect(() => {
    fetch("/api/project-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ProjectTypeOption[]) => {
        if (Array.isArray(rows) && rows.length > 0) setTypes(rows);
      })
      .catch(() => {});
  }, []);

  // Modèles du type choisi : un seul → sélectionné d'office ; plusieurs → choix de l'utilisateur.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project-templates/options?type=${encodeURIComponent(form.type)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { options: TemplateOption[]; autoSelectedId: string | null; fallbackGeneralId: string | null } | null) => {
        if (cancelled || !res) return;
        setTemplates(res.options);
        setTemplateId(res.autoSelectedId ?? res.options[0]?.id ?? "");
        setFallbackGeneral(res.options.length === 0 && !!res.fallbackGeneralId);
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
          setTemplateId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.type]);

  const establishmentsInGroup = establishments.filter((e) => e.groupId === groupId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setSaving(true);
    const res = await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, groupId, establishmentIds, templateId: templateId || undefined }),
    });
    const initiative = await res.json();
    setSaving(false);
    router.push(`/initiatives/${initiative.id}`);
  }

  if (groups.length === 0) {
    return (
      <div className="card max-w-2xl">
        <p className="text-sm text-bad">
          Créez d'abord un groupe (page Groupes) avant de pouvoir créer une initiative — une initiative appartient toujours à un groupe.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 max-w-2xl">
      <Field label="Groupe">
        <select
          required
          className="input"
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setEstablishmentIds([]); // les établissements sélectionnés dépendent du groupe
          }}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Référence">
          <input required className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field label="Nom de l'initiative">
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>

      <Field label="Description">
        <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type de projet">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
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

      <Field label="Modèle de pilotage">
        {templates.length > 1 ? (
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : templates.length === 1 ? (
          <div className="text-sm text-body">{templates[0].name}</div>
        ) : (
          <div className="text-sm text-ink/60">
            {fallbackGeneral ? "Modèle général (aucun modèle dédié à ce type)." : "Parcours standard du type."}
          </div>
        )}
      </Field>

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

      <Field label="Établissement(s) concerné(s) — dans le groupe sélectionné">
        <div className="flex flex-wrap gap-2">
          {establishmentsInGroup.map((e) => (
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
          {establishmentsInGroup.length === 0 && (
            <span className="text-sm text-ink/50">Aucun établissement dans ce groupe pour l'instant.</span>
          )}
        </div>
      </Field>

      <button className="btn" disabled={saving || !groupId} type="submit">
        {saving ? "Création…" : "Créer l'initiative"}
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
