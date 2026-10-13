"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/Pill";
import { callApi } from "@/components/projectConfig/api";
import Link from "next/link";
import { THEMES_INDICATEUR, labelOf } from "@/lib/referentiels";

export interface IndicatorMeasureView {
  id: string;
  valeur: number;
  dateMesure: string;
  commentaire: string | null;
}

export interface BaselineView {
  id: string;
  valeur: number;
  dateMesure: string;
  source: string | null;
  justificatif: string | null;
  statut: string; // propose | valide | remplace
  auteur: string | null;
  valideLe: string | null;
}

export interface IndicatorView {
  id: string;
  nom: string;
  description: string | null;
  unite: string | null;
  sens: string;
  valeurInitiale: number | null;
  valeurCible: number | null;
  actuelle: number | null;
  progress: number | null; // 0–1, null = non calculable
  frequence: string;
  echeance: string | null;
  responsable: string | null;
  statut: string;
  principal: boolean;
  inherited: boolean; // définition héritée du groupe
  cibleHeritee: boolean;
  cibleLocale: boolean;
  measures: IndicatorMeasureView[];
  theme: string | null;
  baselineState: "a_etablir" | "a_valider" | "etablie";
  baselines: BaselineView[];
  baselineAction: { id: string; title: string; status: string } | null;
}

const FREQ: Record<string, string> = { mensuelle: "Mensuelle", trimestrielle: "Trimestrielle", semestrielle: "Semestrielle", annuelle: "Annuelle", ponctuelle: "Ponctuelle" };
const STATUT: Record<string, string> = { actif: "Actif", atteint: "Atteint", abandonne: "Abandonné" };

function fmt(n: number | null, unite: string | null): string {
  if (n === null || n === undefined) return "—";
  const v = String(n).replace(".", ",");
  return unite ? (unite === "%" ? `${v} %` : `${v} ${unite}`) : v;
}

const today = () => new Date().toISOString().slice(0, 10);

export function IndicatorsSection({ cycleId, indicators, legacyText }: { cycleId: string; indicators: IndicatorView[]; legacyText: string | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState("");
  const showLegacy = indicators.length === 0 && legacyText && legacyText.trim().length > 0;

  return (
    <div>
      {showLegacy && (
        <div className="card mb-3 bg-amber-50/50 border-amber-200/60 text-sm">
          <div className="label mb-1">Saisie antérieure (texte libre)</div>
          <p className="text-body mb-2">{legacyText}</p>
          <button
            className="text-blue hover:underline"
            onClick={() => {
              setPrefill(legacyText as string);
              setAdding(true);
            }}
          >
            Convertir en indicateur chiffré
          </button>
        </div>
      )}

      {indicators.length === 0 && !showLegacy && !adding && <div className="card text-center text-muted py-6 mb-3">Aucun indicateur : la progression n'est pas calculable (« — »). Ajoutez un indicateur pour la mesurer.</div>}

      <div className="space-y-3">
        {indicators.map((ind) => (
          <IndicatorCard key={ind.id} ind={ind} onChanged={() => router.refresh()} />
        ))}
      </div>

      <div className="mt-3">
        {adding ? (
          <IndicatorForm
            title="Nouvel indicateur"
            cycleId={cycleId}
            initialName={prefill}
            onDone={() => {
              setAdding(false);
              setPrefill("");
              router.refresh();
            }}
            onCancel={() => {
              setAdding(false);
              setPrefill("");
            }}
          />
        ) : (
          <button className="btn-secondary" onClick={() => setAdding(true)}>
            + Ajouter un indicateur
          </button>
        )}
      </div>
    </div>
  );
}

function IndicatorCard({ ind, onChanged }: { ind: IndicatorView; onChanged: () => void }) {
  const [mode, setMode] = useState<"" | "measure" | "edit" | "history" | "baseline">("");
  const [bl, setBl] = useState({ valeur: "", dateMesure: today(), source: "", justificatif: "", valider: true });
  const [m, setM] = useState({ valeur: "", dateMesure: today(), commentaire: "" });
  const [e, setE] = useState({
    nom: ind.nom,
    description: ind.description || "",
    unite: ind.unite || "",
    sens: ind.sens,
    frequence: ind.frequence,
    // Sur une copie d'établissement, la cible n'est pré-remplie que si une cible locale existe.
    valeurCible: ind.inherited && ind.cibleHeritee ? "" : ind.valeurCible === null ? "" : String(ind.valeurCible),
    valeurInitiale: ind.valeurInitiale === null ? "" : String(ind.valeurInitiale),
    echeance: ind.echeance ? ind.echeance.slice(0, 10) : "",
    statut: ind.statut,
    theme: ind.theme || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pct = ind.progress === null ? null : Math.round(ind.progress * 100);
  const cibleSymbol = ind.sens === "baisse" ? "≤" : "≥";

  async function saveMeasure() {
    setError("");
    setBusy(true);
    const res = await callApi("POST", `/api/goal-indicators/${ind.id}/measures`, { valeur: m.valeur, dateMesure: m.dateMesure, commentaire: m.commentaire || null });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    setM({ valeur: "", dateMesure: today(), commentaire: "" });
    setMode("");
    onChanged();
  }

  async function saveBaseline() {
    setError("");
    setBusy(true);
    const res = await callApi("POST", `/api/goal-indicators/${ind.id}/baseline`, { ...bl, source: bl.source || null, justificatif: bl.justificatif || null });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    setBl({ valeur: "", dateMesure: today(), source: "", justificatif: "", valider: true });
    setMode("");
    onChanged();
  }

  async function proposeAction() {
    setError("");
    setBusy(true);
    const res = await callApi("POST", `/api/goal-indicators/${ind.id}/baseline-action`, {});
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    onChanged();
  }

  async function validateProposed(id: string) {
    setBusy(true);
    const res = await callApi("PATCH", `/api/goal-indicator-baselines/${id}`, {});
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    onChanged();
  }

  async function saveEdit() {
    setError("");
    setBusy(true);
    const body: Record<string, unknown> = {
      valeurInitiale: e.valeurInitiale.trim() === "" ? null : e.valeurInitiale,
      valeurCible: e.valeurCible || null,
      echeance: e.echeance || null,
      statut: e.statut,
    };
    if (!ind.inherited) Object.assign(body, { nom: e.nom, description: e.description || null, unite: e.unite || null, sens: e.sens, frequence: e.frequence, theme: e.theme || null });
    const res = await callApi("PATCH", `/api/goal-indicators/${ind.id}`, body);
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    setMode("");
    onChanged();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium text-ink flex items-center gap-2 flex-wrap">
            {ind.nom}
            {ind.principal && <Pill text="Principal" tone="ok" />}
            {ind.inherited && <Pill text="Défini par le groupe" tone="neutral" />}
            {ind.statut !== "actif" && <Pill text={STATUT[ind.statut] || ind.statut} tone={ind.statut === "atteint" ? "ok" : "neutral"} />}
          </div>
          {ind.theme && <div className="text-xs text-teal-700 mt-0.5">Thème : {labelOf(THEMES_INDICATEUR, ind.theme)}</div>}
          {ind.description && <div className="text-sm text-muted mt-0.5">{ind.description}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-display text-ink">{pct === null ? "—" : `${pct} %`}</div>
          <div className="text-xs text-muted">progression</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
        <span className="rounded bg-ink/5 px-2 py-1">
          <span className="text-xs text-muted">Initiale </span>
          {ind.valeurInitiale === null ? <span className="text-amber-700">Non renseignée</span> : fmt(ind.valeurInitiale, ind.unite)}
        </span>
        <span className="text-muted">→</span>
        <span className="rounded bg-teal-50 px-2 py-1">
          <span className="text-xs text-muted">Actuelle </span>
          <strong>{fmt(ind.actuelle, ind.unite)}</strong>
        </span>
        <span className="text-muted">→</span>
        <span className="rounded bg-ink/5 px-2 py-1">
          <span className="text-xs text-muted">Cible {cibleSymbol} </span>
          {fmt(ind.valeurCible, ind.unite)}
          {ind.inherited && ind.cibleHeritee && <span className="text-xs text-muted"> (cible du groupe)</span>}
          {ind.inherited && ind.cibleLocale && <span className="text-xs text-muted"> (cible locale)</span>}
        </span>
      </div>

      {ind.baselineState !== "etablie" && (
        <div className="mt-3 rounded-md border border-amber-200/70 bg-amber-50/50 p-3 text-sm space-y-2">
          <div>
            <strong>{ind.baselineState === "a_valider" ? "Valeur initiale proposée, en attente de validation." : "Valeur initiale à établir."}</strong>{" "}
            <span className="text-muted">Une valeur inconnue n'est pas égale à zéro : aucune progression n'est calculée tant que la situation de départ n'est pas établie.</span>
          </div>
          {ind.baselineAction ? (
            <div className="text-xs">
              Action d'état des lieux : <Link className="text-blue hover:underline" href={`/actions/${ind.baselineAction.id}/audit`}>{ind.baselineAction.title} — réaliser l'audit</Link> · statut {ind.baselineAction.status.replace("_", " ")}
              {ind.baselineAction.status === "termine" && <span className="text-teal-700"> — terminée : renseignez puis validez la valeur initiale.</span>}
            </div>
          ) : (
            <button className="text-blue hover:underline text-xs" disabled={busy} onClick={proposeAction}>
              Proposer l'action « État des lieux initial »
            </button>
          )}
          {ind.baselines.filter((b) => b.statut === "propose").map((b) => (
            <div key={b.id} className="flex items-center gap-3 text-xs">
              <span>Proposée : <strong>{fmt(b.valeur, ind.unite)}</strong> ({new Date(b.dateMesure).toLocaleDateString("fr-FR")}{b.source ? ` · ${b.source}` : ""})</span>
              <button className="text-blue hover:underline" disabled={busy} onClick={() => validateProposed(b.id)}>
                Valider comme valeur initiale
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 h-1.5 rounded bg-ink/10 overflow-hidden" aria-hidden>
        <div className="h-full bg-teal-600" style={{ width: `${pct ?? 0}%` }} />
      </div>
      {pct === null && <p className="text-xs text-muted mt-1">Progression non calculable : il faut une valeur initiale établie, une cible et au moins une mesure.</p>}

      <div className="mt-2 text-xs text-muted">
        {FREQ[ind.frequence] || ind.frequence}
        {ind.echeance ? ` · échéance ${new Date(ind.echeance).toLocaleDateString("fr-FR")}` : ""}
        {ind.responsable ? ` · ${ind.responsable}` : ""}
      </div>

      <div className="mt-3 flex gap-4 text-sm">
        <button className="text-blue hover:underline" onClick={() => setMode(mode === "measure" ? "" : "measure")}>
          Saisir une mesure
        </button>
        <button className="text-blue hover:underline" onClick={() => setMode(mode === "baseline" ? "" : "baseline")}>
          {ind.baselineState === "etablie" ? "Valeur initiale" : "Établir la valeur initiale"}
        </button>
        <button className="text-blue hover:underline" onClick={() => setMode(mode === "edit" ? "" : "edit")}>
          Modifier
        </button>
        <button className="text-blue hover:underline" onClick={() => setMode(mode === "history" ? "" : "history")}>
          Historique ({ind.measures.length})
        </button>
      </div>

      {mode === "measure" && (
        <div className="mt-3 grid sm:grid-cols-4 gap-2 items-end">
          <label className="block">
            <div className="label mb-1">Valeur{ind.unite ? ` (${ind.unite})` : ""}</div>
            <input className="input" inputMode="decimal" value={m.valeur} onChange={(ev) => setM({ ...m, valeur: ev.target.value })} />
          </label>
          <label className="block">
            <div className="label mb-1">Date</div>
            <input type="date" className="input" value={m.dateMesure} onChange={(ev) => setM({ ...m, dateMesure: ev.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <div className="label mb-1">Commentaire</div>
            <input className="input" value={m.commentaire} onChange={(ev) => setM({ ...m, commentaire: ev.target.value })} />
          </label>
          <div className="sm:col-span-4 flex gap-2">
            <button className="btn" disabled={busy || !m.valeur.trim()} onClick={saveMeasure}>
              Enregistrer la mesure
            </button>
            <button className="btn-secondary" onClick={() => setMode("")}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === "baseline" && (
        <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2 items-end">
            <label className="block">
              <div className="label mb-1">Valeur initiale{ind.unite ? ` (${ind.unite})` : ""} — 0 est une valeur valide</div>
              <input className="input" inputMode="decimal" value={bl.valeur} onChange={(ev) => setBl({ ...bl, valeur: ev.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Date de la mesure</div>
              <input type="date" className="input" value={bl.dateMesure} onChange={(ev) => setBl({ ...bl, dateMesure: ev.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Source</div>
              <input className="input" value={bl.source} onChange={(ev) => setBl({ ...bl, source: ev.target.value })} placeholder="Ex. audit interne" />
            </label>
            <label className="block">
              <div className="label mb-1">Justificatif (référence)</div>
              <input className="input" value={bl.justificatif} onChange={(ev) => setBl({ ...bl, justificatif: ev.target.value })} placeholder="Rapport, document…" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bl.valider} onChange={(ev) => setBl({ ...bl, valider: ev.target.checked })} />
            Valider comme valeur initiale de référence (sinon : proposée, en attente de validation des résultats)
          </label>
          <p className="text-xs text-muted">Les justificatifs (fichiers) se rattachent via les documents de l'objectif. Les valeurs précédentes sont conservées dans l'historique.</p>
          <div className="flex gap-2">
            <button className="btn" disabled={busy || !bl.valeur.trim()} onClick={saveBaseline}>
              Enregistrer
            </button>
            <button className="btn-secondary" onClick={() => setMode("")}>
              Annuler
            </button>
          </div>
          {ind.baselines.length > 0 && (
            <ul className="divide-y divide-ink/5 text-sm">
              {ind.baselines.map((b) => (
                <li key={b.id} className="py-1.5">
                  <strong>{fmt(b.valeur, ind.unite)}</strong> <span className="text-muted">· {new Date(b.dateMesure).toLocaleDateString("fr-FR")}{b.source ? ` · ${b.source}` : ""}{b.justificatif ? ` · ${b.justificatif}` : ""}</span>{" "}
                  <span className="text-xs rounded bg-ink/5 px-1.5 py-0.5">{b.statut === "valide" ? "En vigueur" : b.statut === "propose" ? "Proposée" : "Remplacée"}</span>
                  {b.auteur && <span className="text-xs text-muted"> · {b.auteur}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-3 space-y-2">
          {ind.inherited ? (
            <p className="text-xs text-muted">La définition (nom, unité, sens, fréquence) est maîtrisée par le groupe pour garantir la comparabilité entre établissements. Vous renseignez votre valeur initiale, votre cible locale (facultative) et vos mesures.</p>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <label className="block sm:col-span-2">
                <div className="label mb-1">Nom</div>
                <input className="input" value={e.nom} onChange={(ev) => setE({ ...e, nom: ev.target.value })} />
              </label>
              <label className="block">
                <div className="label mb-1">Unité</div>
                <input className="input" value={e.unite} onChange={(ev) => setE({ ...e, unite: ev.target.value })} />
              </label>
              <label className="block sm:col-span-2 xl:col-span-4">
                <div className="label mb-1">Description</div>
                <input className="input" value={e.description} onChange={(ev) => setE({ ...e, description: ev.target.value })} />
              </label>
              <label className="block">
                <div className="label mb-1">Thème</div>
                <select className="input" value={e.theme} onChange={(ev) => setE({ ...e, theme: ev.target.value })}>
                  <option value="">— Non défini —</option>
                  {THEMES_INDICATEUR.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="label mb-1">Sens</div>
                <select className="input" value={e.sens} onChange={(ev) => setE({ ...e, sens: ev.target.value })}>
                  <option value="hausse">≥ cible (hausse)</option>
                  <option value="baisse">≤ cible (baisse)</option>
                </select>
              </label>
              <label className="block">
                <div className="label mb-1">Fréquence</div>
                <select className="input" value={e.frequence} onChange={(ev) => setE({ ...e, frequence: ev.target.value })}>
                  {Object.entries(FREQ).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="grid sm:grid-cols-4 gap-2">
            <label className="block">
              <div className="label mb-1">Valeur initiale</div>
              <input className="input" inputMode="decimal" value={e.valeurInitiale} onChange={(ev) => setE({ ...e, valeurInitiale: ev.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">{ind.inherited ? "Cible locale (vide = groupe)" : "Valeur cible"}</div>
              <input className="input" inputMode="decimal" value={e.valeurCible} onChange={(ev) => setE({ ...e, valeurCible: ev.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Échéance</div>
              <input type="date" className="input" value={e.echeance} onChange={(ev) => setE({ ...e, echeance: ev.target.value })} />
            </label>
            <label className="block">
              <div className="label mb-1">Statut</div>
              <select className="input" value={e.statut} onChange={(ev) => setE({ ...e, statut: ev.target.value })}>
                {Object.entries(STATUT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn" disabled={busy} onClick={saveEdit}>
              Enregistrer
            </button>
            <button className="btn-secondary" onClick={() => setMode("")}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === "history" && (
        <div className="mt-3">
          {ind.measures.length === 0 ? (
            <p className="text-sm text-muted">Aucune mesure saisie.</p>
          ) : (
            <ul className="divide-y divide-ink/5 text-sm">
              {ind.measures.map((ms) => (
                <li key={ms.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span>
                    <strong>{fmt(ms.valeur, ind.unite)}</strong> <span className="text-muted">· {new Date(ms.dateMesure).toLocaleDateString("fr-FR")}</span>
                    {ms.commentaire && <span className="text-muted"> — {ms.commentaire}</span>}
                  </span>
                  <button
                    className="text-xs text-bad hover:underline"
                    onClick={async () => {
                      if (!confirm("Supprimer cette mesure ? La suppression est tracée dans l'historique.")) return;
                      const res = await callApi("DELETE", `/api/goal-indicator-measures/${ms.id}`);
                      if (!res.ok) return alert(res.error);
                      onChanged();
                    }}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-sm text-bad mt-2">{error}</p>}
    </div>
  );
}

function IndicatorForm({ title, cycleId, initialName, onDone, onCancel }: { title: string; cycleId: string; initialName: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ nom: initialName, unite: "", sens: "hausse", valeurInitiale: "", valeurActuelle: "", valeurCible: "", frequence: "trimestrielle", echeance: "", description: "", theme: "", baselineSource: "", baselineDate: "" });
  const [proposeAction, setProposeAction] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="card space-y-2">
      <div className="label">{title}</div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <label className="block sm:col-span-2">
          <div className="label mb-1">Nom *</div>
          <input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Unité</div>
          <input className="input" value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value })} placeholder="%" />
        </label>
        <label className="block">
          <div className="label mb-1">Thème</div>
          <select className="input" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })}>
            <option value="">— Non défini —</option>
            {THEMES_INDICATEUR.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 xl:col-span-4">
          <div className="label mb-1">Description</div>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Sens</div>
          <select className="input" value={f.sens} onChange={(e) => setF({ ...f, sens: e.target.value })}>
            <option value="hausse">≥ cible (hausse)</option>
            <option value="baisse">≤ cible (baisse)</option>
          </select>
        </label>
        <label className="block">
          <div className="label mb-1">Fréquence</div>
          <select className="input" value={f.frequence} onChange={(e) => setF({ ...f, frequence: e.target.value })}>
            {Object.entries(FREQ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="label mb-1">Échéance</div>
          <input type="date" className="input" value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Valeur initiale</div>
          <input className="input" inputMode="decimal" value={f.valeurInitiale} onChange={(e) => setF({ ...f, valeurInitiale: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Valeur actuelle</div>
          <input className="input" inputMode="decimal" value={f.valeurActuelle} onChange={(e) => setF({ ...f, valeurActuelle: e.target.value })} />
        </label>
        <label className="block">
          <div className="label mb-1">Valeur cible</div>
          <input className="input" inputMode="decimal" value={f.valeurCible} onChange={(e) => setF({ ...f, valeurCible: e.target.value })} />
        </label>
      </div>
      {f.valeurInitiale.trim() !== "" ? (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block">
            <div className="label mb-1">Source de la valeur initiale (facultatif)</div>
            <input className="input" value={f.baselineSource} onChange={(e) => setF({ ...f, baselineSource: e.target.value })} />
          </label>
          <label className="block">
            <div className="label mb-1">Date de la mesure initiale</div>
            <input type="date" className="input" value={f.baselineDate} onChange={(e) => setF({ ...f, baselineDate: e.target.value })} />
          </label>
        </div>
      ) : (
        <label className="flex items-start gap-2 text-sm rounded-md bg-amber-50/50 border border-amber-200/70 p-3">
          <input type="checkbox" className="mt-1" checked={proposeAction} onChange={(e) => setProposeAction(e.target.checked)} />
          <span>
            <strong>Valeur initiale inconnue</strong> — proposer l'action « État des lieux initial ». Si une action d'état des lieux existe déjà pour cet objectif, l'indicateur y sera rattaché (pas de doublon). Décochez si une mesure fiable existe déjà.
          </span>
        </label>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn"
          disabled={busy || !f.nom.trim()}
          onClick={async () => {
            setError("");
            setBusy(true);
            const res = await callApi("POST", `/api/objectives/${cycleId}/indicators`, {
              ...f,
              description: f.description || null,
              unite: f.unite || null,
              valeurInitiale: f.valeurInitiale || null,
              valeurActuelle: f.valeurActuelle || null,
              valeurCible: f.valeurCible || null,
              echeance: f.echeance || null,
              theme: f.theme || null,
              baselineSource: f.baselineSource || null,
              baselineDate: f.baselineDate || null,
              proposeBaselineAction: proposeAction,
            });
            setBusy(false);
            if (!res.ok) return setError(res.error || "Erreur.");
            onDone();
          }}
        >
          Ajouter
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
