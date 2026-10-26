"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/components/projectConfig/api";
import { TRACKED_FIELDS } from "@/lib/declinaison";

export interface ChangeView {
  id: string;
  createdAt: string;
  auteur: string | null;
  changes: Record<string, { from: string | null; to: string | null; auto: boolean }>;
  toApply: string[];
}

const label = (k: string) => TRACKED_FIELDS.find((f) => f.key === k)?.label || k;
const show = (v: string | null) => (v === null || v === "" ? "—" : v.length > 160 ? v.slice(0, 159) + "…" : v);

// Déclinaison locale d'un objectif du groupe : état de prise en charge déclaré par l'établissement, dérogation, changements du groupe à examiner.
export function DeclinationPanel({
  cycleId,
  etat,
  etatLabel,
  derogation,
  changes,
  canModify,
}: {
  cycleId: string;
  etat: string | null;
  etatLabel: string;
  derogation: { statut: string; motif: string | null; demandeePar: string | null; decisionPar: string | null; decisionNote: string | null } | null;
  changes: ChangeView[];
  canModify: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [asking, setAsking] = useState(false);

  async function post(path: string, body: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await callApi("POST", `/api/objectives/${cycleId}/${path}`, body);
    setBusy(false);
    if (!res.ok) return setMsg(res.error || "Erreur.");
    setAsking(false);
    setMotif("");
    router.refresh();
  }

  const locked = etat === "hors_perimetre" || etat === "non_applicable" || derogation?.statut === "demandee";
  const buttons: { action: string; text: string; show: boolean }[] = [
    { action: "prendre_en_charge", text: "Prendre en charge", show: !etat || etat === "non_pris_en_charge" },
    { action: "demarrer", text: "Démarrer la mise en œuvre", show: etat === "pris_en_charge" },
    { action: "annuler_prise_en_charge", text: "Annuler la prise en charge", show: etat === "pris_en_charge" },
    { action: "terminer", text: "Marquer terminé", show: etat === "en_cours" },
    { action: "rouvrir", text: "Rouvrir", show: etat === "termine" },
  ];
  const canAskDerogation = canModify && (!derogation || derogation.statut === "refusee") && (!etat || etat === "non_pris_en_charge" || etat === "pris_en_charge");

  return (
    <div className="card space-y-4">
      <div>
        <div className="label">État de prise en charge</div>
        <div className="text-base text-ink">{etatLabel}</div>
        {etat === "hors_perimetre" && <p className="text-xs text-muted mt-1">Cet établissement n'est plus dans le périmètre de l'objectif. Tout est conservé, en lecture seule ; si l'établissement revient, l'état précédent est restauré.</p>}
        {etat === "non_applicable" && <p className="text-xs text-muted mt-1">Une dérogation a été validée par le groupe : aucune action n'est attendue.</p>}
      </div>

      {derogation && (
        <div className="rounded border border-line px-3 py-2 text-sm space-y-1">
          <div className="font-medium text-ink">
            Dérogation {derogation.statut === "demandee" ? "demandée" : derogation.statut === "validee" ? "validée" : "refusée"}
          </div>
          {derogation.motif && <div>Motif : {derogation.motif}</div>}
          {derogation.decisionNote && <div>Décision{derogation.decisionPar ? ` (${derogation.decisionPar})` : ""} : {derogation.decisionNote}</div>}
          {canModify && derogation.statut === "demandee" && (
            <button className="btn-secondary" disabled={busy} onClick={() => post("derogation", { action: "retirer" })}>
              Retirer ma demande
            </button>
          )}
        </div>
      )}

      {canModify && !locked && (
        <div className="flex flex-wrap gap-2">
          {buttons.filter((b) => b.show).map((b) => (
            <button key={b.action} className={b.action === "annuler_prise_en_charge" ? "btn-secondary" : "btn"} disabled={busy} onClick={() => post("etat", { action: b.action })}>
              {b.text}
            </button>
          ))}
        </div>
      )}

      {canAskDerogation && !asking && (
        <button className="btn-secondary" onClick={() => setAsking(true)}>
          Demander une dérogation
        </button>
      )}
      {asking && (
        <div className="space-y-2">
          <label className="label">Motif de la dérogation (obligatoire)</label>
          <textarea className="input" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn" disabled={busy || !motif.trim()} onClick={() => post("derogation", { action: "demander", motif })}>
              Envoyer la demande
            </button>
            <button className="btn-secondary" onClick={() => setAsking(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="space-y-3">
          <div className="label">Changements du groupe à examiner ({changes.length})</div>
          {changes.map((c) => (
            <div key={c.id} className="rounded border border-warn/40 px-3 py-2 text-sm space-y-2">
              <div className="text-xs text-muted">
                {new Date(c.createdAt).toLocaleString("fr-FR")}
                {c.auteur ? ` · ${c.auteur}` : ""}
              </div>
              <ul className="space-y-1">
                {Object.entries(c.changes).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium">{label(k)}</span> : {show(v.from)} → {show(v.to)}
                    {v.auto && <span className="text-xs text-muted"> (déjà appliqué automatiquement)</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                {c.toApply.length > 0 ? `« Accepter » recopie : ${c.toApply.map(label).join(", ")}. Votre cible, vos indicateurs, votre responsable et votre statut ne sont jamais modifiés.` : "Information seulement : rien à recopier."}
              </p>
              {canModify && etat !== "hors_perimetre" && (
                <div className="flex gap-2">
                  <button className="btn" disabled={busy} onClick={() => post(`changes/${c.id}`, { decision: "accepte" })}>
                    Accepter
                  </button>
                  <button className="btn-secondary" disabled={busy} onClick={() => post(`changes/${c.id}`, { decision: "ignore" })}>
                    Ignorer (garder le local)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-sm text-bad">{msg}</p>}
    </div>
  );
}
