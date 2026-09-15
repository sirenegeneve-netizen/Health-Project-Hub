"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HealthBadge } from "@/components/HealthBadge";
import { Pill } from "@/components/Pill";
import type { HealthLevel } from "@/lib/healthScore";

export interface ExplorerInitiative {
  id: string;
  name: string;
  reference: string;
  type: string;
  typeLabel: string;
  status: string; // actif | en_pause | cloture
  priority: string;
  chefDeProjet: string | null;
  groupName: string;
  targetDate: string | null;
  late: boolean;
  establishments: string[];
  healthLevel: HealthLevel;
  healthLabel: string;
  blocked: boolean;
  progress: number | null;
  stageLabel: string;
}

const PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", critique: "Critique" };
const STATUS_LABELS: Record<string, string> = { actif: "Actif", en_pause: "En pause", cloture: "Clôturé" };
const HEALTH_LABELS: Record<string, string> = { vert: "🟢 Sain", orange: "🟠 Attention", rouge: "🔴 À risque" };
const PERIOD_OPTIONS = [
  { key: "toutes", label: "Toutes échéances" },
  { key: "30", label: "Dans les 30 jours" },
  { key: "90", label: "Dans les 90 jours" },
  { key: "depassees", label: "Échéances dépassées" },
];

const ALL = "tous";

export function InitiativesExplorer({ initiatives, initialTab }: { initiatives: ExplorerInitiative[]; initialTab?: string }) {
  const [query, setQuery] = useState("");
  const [groupe, setGroupe] = useState(ALL);
  const [etablissement, setEtablissement] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [statut, setStatut] = useState(ALL);
  const [phase, setPhase] = useState(ALL);
  const [responsable, setResponsable] = useState(ALL);
  const [risque, setRisque] = useState(ALL);
  const [priorite, setPriorite] = useState(ALL);
  const [periode, setPeriode] = useState("toutes");
  const [retardSeul, setRetardSeul] = useState(false);
  const [bloqueSeul, setBloqueSeul] = useState(false);

  // Filtres pré-remplis pour reprendre la sémantique des anciens liens (ex.
  // StatCards "?vue=a_risque") sans dupliquer un système de filtre séparé.
  useMemo(() => {
    if (initialTab === "a_risque") setRisque("rouge");
    if (initialTab === "actifs") setStatut("actif");
    if (initialTab === "termines") setStatut("cloture");
    if (initialTab === "bloques") setBloqueSeul(true);
  }, [initialTab]);

  const groupes = useMemo(() => Array.from(new Set(initiatives.map((p) => p.groupName))).sort(), [initiatives]);
  const etablissements = useMemo(() => Array.from(new Set(initiatives.flatMap((p) => p.establishments))).sort(), [initiatives]);
  const types = useMemo(() => Array.from(new Set(initiatives.map((p) => p.type))), [initiatives]);
  const phases = useMemo(() => Array.from(new Set(initiatives.map((p) => p.stageLabel))).sort(), [initiatives]);
  const responsables = useMemo(
    () => Array.from(new Set(initiatives.map((p) => p.chefDeProjet).filter((x): x is string => !!x))).sort(),
    [initiatives]
  );

  const filtered = initiatives
    .filter((p) => {
      if (query && !`${p.name} ${p.reference} ${p.chefDeProjet || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (groupe !== ALL && p.groupName !== groupe) return false;
      if (etablissement !== ALL && !p.establishments.includes(etablissement)) return false;
      if (type !== ALL && p.type !== type) return false;
      if (statut !== ALL && p.status !== statut) return false;
      if (phase !== ALL && p.stageLabel !== phase) return false;
      if (responsable !== ALL && p.chefDeProjet !== responsable) return false;
      if (risque !== ALL && p.healthLevel !== risque) return false;
      if (priorite !== ALL && p.priority !== priorite) return false;
      if (retardSeul && !p.late) return false;
      if (bloqueSeul && !p.blocked) return false;
      if (periode !== "toutes") {
        if (!p.targetDate) return false;
        const days = (new Date(p.targetDate).getTime() - Date.now()) / 86400000;
        if (periode === "30" && !(days >= 0 && days <= 30)) return false;
        if (periode === "90" && !(days >= 0 && days <= 90)) return false;
        if (periode === "depassees" && !(days < 0 && p.status !== "cloture")) return false;
      }
      return true;
    })
    .sort((a, b) => (a.targetDate ? new Date(a.targetDate).getTime() : Infinity) - (b.targetDate ? new Date(b.targetDate).getTime() : Infinity));

  const activeCount = [groupe, etablissement, type, statut, phase, responsable, risque, priorite].filter((v) => v !== ALL).length + (periode !== "toutes" ? 1 : 0) + (retardSeul ? 1 : 0) + (bloqueSeul ? 1 : 0);

  function reset() {
    setQuery("");
    setGroupe(ALL);
    setEtablissement(ALL);
    setType(ALL);
    setStatut(ALL);
    setPhase(ALL);
    setResponsable(ALL);
    setRisque(ALL);
    setPriorite(ALL);
    setPeriode("toutes");
    setRetardSeul(false);
    setBloqueSeul(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input className="input max-w-xs" placeholder="Rechercher une initiative…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {activeCount > 0 && (
          <button className="text-xs text-blue hover:underline" onClick={reset}>
            Réinitialiser les filtres ({activeCount})
          </button>
        )}
        <span className="text-xs text-ink/40 ml-auto">
          {filtered.length} / {initiatives.length} initiative{initiatives.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {groupes.length > 1 && (
          <select className="input w-auto text-sm" value={groupe} onChange={(e) => setGroupe(e.target.value)}>
            <option value={ALL}>Tous les groupes</option>
            {groupes.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
        <select className="input w-auto text-sm" value={etablissement} onChange={(e) => setEtablissement(e.target.value)}>
          <option value={ALL}>Tous les établissements</option>
          {etablissements.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ALL}>Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{initiatives.find((p) => p.type === t)?.typeLabel || t}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value={ALL}>Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value={ALL}>Toutes les étapes</option>
          {phases.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
          <option value={ALL}>Tous les responsables</option>
          {responsables.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={risque} onChange={(e) => setRisque(e.target.value)}>
          <option value={ALL}>Tous les niveaux de risque</option>
          {Object.entries(HEALTH_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
          <option value={ALL}>Toutes les priorités</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="input w-auto text-sm" value={periode} onChange={(e) => setPeriode(e.target.value)}>
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink/70 px-2">
          <input type="checkbox" checked={retardSeul} onChange={(e) => setRetardSeul(e.target.checked)} />
          En retard uniquement
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink/70 px-2">
          <input type="checkbox" checked={bloqueSeul} onChange={(e) => setBloqueSeul(e.target.checked)} />
          Bloqués uniquement
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucune initiative ne correspond à ces filtres.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-line">
                <th className="px-4 py-3 font-medium">Initiative</th>
                <th className="px-4 py-3 font-medium">Établissement</th>
                <th className="px-4 py-3 font-medium">Chef de projet</th>
                <th className="px-4 py-3 font-medium">Étape</th>
                <th className="px-4 py-3 font-medium">Avancement</th>
                <th className="px-4 py-3 font-medium">Priorité</th>
                <th className="px-4 py-3 font-medium">Échéance</th>
                <th className="px-4 py-3 font-medium">Santé</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/60">
                  <td className="px-4 py-3">
                    <Link href={`/initiatives/${p.id}`} className="font-medium text-ink hover:text-primary">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink/40">{p.reference} · {p.typeLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{p.establishments.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{p.chefDeProjet || "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{p.stageLabel}</td>
                  <td className="px-4 py-3 text-ink/70">{p.progress !== null ? `${p.progress} %` : "—"}</td>
                  <td className="px-4 py-3">
                    <Pill text={PRIORITY_LABELS[p.priority] || p.priority} tone={p.priority === "critique" ? "bad" : p.priority === "haute" ? "warn" : "neutral"} />
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {p.targetDate ? new Date(p.targetDate).toLocaleDateString("fr-FR") : "—"}
                    {p.late && <span className="ml-1.5 text-xs text-bad">retard</span>}
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge level={p.healthLevel} label={p.healthLabel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
