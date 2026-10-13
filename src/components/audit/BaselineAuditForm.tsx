"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/components/projectConfig/api";
import { MultiSelectChips } from "@/components/objectif/MultiSelectChips";
import {
  AUDIT_METHODES, AUDIT_RESULTAT_LABELS, AUDIT_RESULTATS, GLOBAL_SCOPE, RISK_LEVELS, emptyContenu,
  type AuditContenu, type AuditResultat,
} from "@/lib/baselineAudit";
import type { loadAuditPageData } from "@/lib/baselineAuditDb";

type PageData = Extract<Awaited<ReturnType<typeof loadAuditPageData>>, { kind: "ok" }>;

interface MeasureState {
  resultat: AuditResultat;
  valeur: string;
  dateReference: string;
  methodeCalcul: string;
  source: string;
  commentaire: string;
}

const STATUS_LABELS: Record<string, string> = {
  non_evalue: "Non évalué",
  brouillon: "Brouillon en cours",
  evalue_sans_resultat: "Évalué, sans résultat exploitable",
  mesure_validee: "Mesure validée",
};
const KIND_LABELS: Record<string, string> = { point_fort: "Point fort", ecart: "Écart", observation: "Observation" };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 space-y-3">
      <h2 className="font-display text-lg text-ink">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function F({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <div className="label mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </label>
  );
}

export function BaselineAuditForm({ data }: { data: PageData }) {
  const router = useRouter();
  const locked = data.audit?.statut === "valide";
  const [date, setDate] = useState(data.audit?.dateRealisation || "");
  const [auditeur, setAuditeur] = useState(data.audit?.auditeur || "");
  const [c, setC] = useState<AuditContenu>(() => (data.audit?.contenu as AuditContenu | undefined) ?? emptyContenu());
  const [measures, setMeasures] = useState<Record<string, MeasureState>>(() => {
    const init: Record<string, MeasureState> = {};
    for (const ind of data.indicators) {
      const m = data.audit?.measures.find((x) => x.goalIndicatorId === ind.id);
      init[ind.id] = {
        resultat: (m?.resultat as AuditResultat) || "non_realisee",
        valeur: m && m.valeur !== null && m.valeur !== undefined ? String(m.valeur) : "",
        dateReference: m?.dateReference || "",
        methodeCalcul: m?.methodeCalcul || "",
        source: m?.source || "",
        commentaire: m?.commentaire || "",
      };
    }
    return init;
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const upd = (patch: Partial<AuditContenu>) => {
    setC({ ...c, ...patch });
    setDirty(true);
  };
  const updM = (id: string, patch: Partial<MeasureState>) => {
    setMeasures({ ...measures, [id]: { ...measures[id], ...patch } });
    setDirty(true);
  };

  const payload = () => ({
    scopeKey: data.scopeKey,
    dateRealisation: date || null,
    auditeur,
    contenu: c,
    measures: data.indicators.map((i) => ({ goalIndicatorId: i.id, ...measures[i.id], valeur: measures[i.id].valeur })),
  });

  // Enregistre le brouillon et renvoie l'identifiant de l'audit (null en cas d'erreur, données conservées à l'écran).
  async function save(): Promise<string | null> {
    setErrors([]);
    setInfo("");
    const res = await callApi("PUT", `/api/actions/${data.action.id}/audit`, payload());
    if (!res.ok) {
      setErrors(res.data?.errors?.length ? res.data.errors : [res.error || "Erreur."]);
      return null;
    }
    setDirty(false);
    return String(res.data?.id);
  }

  async function saveDraft() {
    setBusy(true);
    const savedId = await save();
    setBusy(false);
    if (savedId) {
      setInfo("Brouillon enregistré. Vous pouvez le reprendre à tout moment.");
      router.refresh();
    }
  }

  async function validate() {
    if (!confirm("Valider l'audit ? Il sera verrouillé, les constats seront enregistrés et les valeurs initiales mesurées mises à jour.")) return;
    setBusy(true);
    // Les données saisies sont d'abord enregistrées : en cas d'erreur de validation, rien n'est perdu.
    const auditId = await save();
    if (!auditId) return setBusy(false);
    const res = await callApi("POST", `/api/baseline-audits/${auditId}/validate`);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.data?.errors?.length ? res.data.errors : [res.error || "Erreur."]);
      return;
    }
    const notApplied: string[] = res.data?.notApplied || [];
    setInfo(
      `Audit validé. ${res.data?.applied ?? 0} valeur(s) initiale(s) mise(s) à jour.` +
        (notApplied.length ? ` Non appliquée(s) faute de copie d'objectif dans l'établissement : ${notApplied.join(", ")}.` : "")
    );
    router.refresh();
  }

  async function createCorrective(findingId: string) {
    setBusy(true);
    const res = await callApi("POST", `/api/audit-findings/${findingId}/corrective-action`, {});
    setBusy(false);
    if (!res.ok) return setErrors([res.error || "Erreur."]);
    setInfo(res.data?.created ? "Action corrective créée dans le module Actions." : "Une action de traitement existe déjà pour ce constat.");
    router.refresh();
  }

  async function registerRisk(index: number) {
    if (!data.audit) return;
    setBusy(true);
    const res = await callApi("POST", `/api/baseline-audits/${data.audit.id}/risks`, { index });
    setBusy(false);
    if (!res.ok) return setErrors([res.error || "Erreur."]);
    setInfo(res.data?.created ? "Risque ajouté au registre des risques." : "Ce risque est déjà enregistré.");
    router.refresh();
  }

  async function closeAction() {
    if (!confirm("Marquer l'action comme terminée ?")) return;
    setBusy(true);
    const res = await callApi("PATCH", `/api/actions/${data.action.id}`, { status: "termine" });
    setBusy(false);
    if (!res.ok) return setErrors([res.error || "Erreur."]);
    router.refresh();
  }

  function changeScope(key: string) {
    if (dirty && !confirm("Des modifications non enregistrées seront perdues. Changer de périmètre ?")) return;
    router.push(`/actions/${data.action.id}/audit?perimetre=${encodeURIComponent(key)}`);
  }

  const dis = locked || busy;

  return (
    <div>
      {data.consolidation && (
        <section className="card mb-4">
          <h2 className="font-display text-lg text-ink mb-1">Consolidation par établissement</h2>
          <p className="text-sm text-muted mb-3">
            {data.consolidation.counts.mesure_validee} / {data.consolidation.total} établissement(s) avec une mesure validée.
            {data.consolidation.counts.non_evalue + data.consolidation.counts.brouillon > 0 && ` ${data.consolidation.counts.non_evalue + data.consolidation.counts.brouillon} évaluation(s) manquante(s) ou en cours.`} Aucune valeur n'est agrégée
            automatiquement : une règle de calcul propre à l'indicateur reste à définir.
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {data.consolidation.rows.map((r) => (
              <button
                key={r.establishmentId}
                type="button"
                onClick={() => changeScope(r.establishmentId)}
                className={`text-left rounded-md border p-2 text-sm ${data.scopeKey === r.establishmentId ? "border-primary bg-teal-50/60" : "border-ink/10 hover:bg-teal-50/40"}`}
              >
                <div className="font-medium">{r.name}</div>
                <div className={`text-xs ${r.status === "mesure_validee" ? "text-teal-700" : r.status === "evalue_sans_resultat" ? "text-amber-700" : "text-muted"}`}>{STATUS_LABELS[r.status]}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {locked && (
        <div className="card mb-4 border-teal-200 bg-teal-50/40 text-sm">
          <strong>Audit validé</strong> le {data.audit?.valideLe ? new Date(data.audit.valideLe).toLocaleDateString("fr-FR") : "—"} par {data.audit?.validePar || "—"}. Il est verrouillé ; pour corriger une valeur initiale, utilisez « Valeur initiale » sur l'indicateur (l'historique est conservé).
        </div>
      )}

      <Section n={1} title="Identification">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3">
          <F label="Établissement ou périmètre évalué">
            <select className="input" value={data.scopeKey} onChange={(e) => changeScope(e.target.value)}>
              <option value={GLOBAL_SCOPE}>{data.establishments.length > 0 ? "Groupe — périmètre global" : "Périmètre de l'objectif"}</option>
              {data.establishments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </F>
          <F label="Date de réalisation de l'audit *">
            <input type="date" className="input" disabled={dis} value={date} onChange={(e) => { setDate(e.target.value); setDirty(true); }} />
          </F>
          <F label="Auditeur / responsable de l'évaluation *" className="xl:col-span-2">
            <input className="input" disabled={dis} value={auditeur} onChange={(e) => { setAuditeur(e.target.value); setDirty(true); }} />
          </F>
          <F label="Personnes ou services consultés (facultatif)" className="sm:col-span-2 xl:col-span-4">
            <input className="input" disabled={dis} value={c.personnesConsultees} onChange={(e) => upd({ personnesConsultees: e.target.value })} />
          </F>
        </div>
      </Section>

      <Section n={2} title="Périmètre et méthode de l'évaluation">
        <div className="grid xl:grid-cols-2 gap-x-4 gap-y-3">
          <F label="Périmètre effectivement audité">
            <textarea className="input" rows={2} disabled={dis} value={c.perimetreAudite} onChange={(e) => upd({ perimetreAudite: e.target.value })} />
          </F>
          <F label="Référentiel ou critères d'évaluation utilisés">
            <textarea className="input" rows={2} disabled={dis} value={c.referentiel} onChange={(e) => upd({ referentiel: e.target.value })} />
          </F>
          <div className="xl:col-span-2">
            <div className="label mb-1">Méthode d'évaluation</div>
            <MultiSelectChips options={AUDIT_METHODES.map((m) => ({ code: m.code, label: m.label }))} value={c.methodes} onChange={(methodes) => !dis && upd({ methodes })} emptyLabel="Aucune méthode sélectionnée" />
          </div>
          <F label="Période de référence des données">
            <input className="input" disabled={dis} value={c.periodeReference} onChange={(e) => upd({ periodeReference: e.target.value })} placeholder="Ex. année 2025" />
          </F>
          <F label="Sources d'information consultées">
            <input className="input" disabled={dis} value={c.sources} onChange={(e) => upd({ sources: e.target.value })} />
          </F>
        </div>
      </Section>

      <Section n={3} title="Constats">
        <F label="Situation existante">
          <textarea className="input" rows={3} disabled={dis} value={c.situationExistante} onChange={(e) => upd({ situationExistante: e.target.value })} />
        </F>
        <div>
          <div className="label mb-1">Points conformes, écarts et observations</div>
          {c.constats.map((k, i) => (
            <div key={i} className="grid sm:grid-cols-12 gap-2 mb-2 items-start">
              <select className="input sm:col-span-2" disabled={dis} value={k.type} onChange={(e) => upd({ constats: c.constats.map((x, j) => (j === i ? { ...x, type: e.target.value as any } : x)) })}>
                <option value="point_fort">Point fort</option>
                <option value="ecart">Écart / non-conformité</option>
                <option value="observation">Observation</option>
              </select>
              <input className="input sm:col-span-4" disabled={dis} placeholder="Intitulé du constat" value={k.libelle} onChange={(e) => upd({ constats: c.constats.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)) })} />
              <input className="input sm:col-span-5" disabled={dis} placeholder="Précisions (facultatif)" value={k.description} onChange={(e) => upd({ constats: c.constats.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              {!dis && (
                <button type="button" className="text-bad text-sm sm:col-span-1" onClick={() => upd({ constats: c.constats.filter((_, j) => j !== i) })}>
                  Retirer
                </button>
              )}
            </div>
          ))}
          {!dis && (
            <div className="flex gap-3 text-sm">
              {(["point_fort", "ecart", "observation"] as const).map((t) => (
                <button key={t} type="button" className="text-blue hover:underline" onClick={() => upd({ constats: [...c.constats, { type: t, libelle: "", description: "" }] })}>
                  + {KIND_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="label mb-1">Risques identifiés</div>
          {c.risques.map((r, i) => (
            <div key={i} className="grid sm:grid-cols-12 gap-2 mb-2 items-start">
              <input className="input sm:col-span-8" disabled={dis} placeholder="Description du risque" value={r.description} onChange={(e) => upd({ risques: c.risques.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              <select className="input sm:col-span-2" disabled={dis} value={r.criticite} onChange={(e) => upd({ risques: c.risques.map((x, j) => (j === i ? { ...x, criticite: e.target.value as any } : x)) })}>
                {RISK_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {!dis ? (
                <button type="button" className="text-bad text-sm sm:col-span-2" onClick={() => upd({ risques: c.risques.filter((_, j) => j !== i) })}>
                  Retirer
                </button>
              ) : c.riskIds?.[i] ? (
                <span className="text-xs text-teal-700 sm:col-span-2">Au registre des risques</span>
              ) : (
                <button type="button" className="text-blue text-sm sm:col-span-2 text-left" disabled={busy} onClick={() => registerRisk(i)}>
                  Ajouter au registre des risques
                </button>
              )}
            </div>
          ))}
          {!dis && (
            <button type="button" className="text-blue hover:underline text-sm" onClick={() => upd({ risques: [...c.risques, { description: "", criticite: "moyenne" }] })}>
              + Risque
            </button>
          )}
        </div>
        <div className="grid xl:grid-cols-2 gap-x-4 gap-y-3">
          <F label="Difficultés ou limites de l'évaluation">
            <textarea className="input" rows={2} disabled={dis} value={c.limites} onChange={(e) => upd({ limites: e.target.value })} />
          </F>
          <F label="Commentaires complémentaires">
            <textarea className="input" rows={2} disabled={dis} value={c.commentaires} onChange={(e) => upd({ commentaires: e.target.value })} />
          </F>
          <F label="Pièces justificatives ou liens (référence)" hint="Les fichiers se rattachent via les documents de l'objectif." className="xl:col-span-2">
            <textarea className="input" rows={2} disabled={dis} value={c.pieces} onChange={(e) => upd({ pieces: e.target.value })} />
          </F>
        </div>
      </Section>

      <Section n={4} title="Mesure de la situation initiale">
        {data.indicators.length === 0 && <p className="text-sm text-muted">Aucun indicateur n'est rattaché à cette action.</p>}
        {data.indicators.map((ind) => {
          const m = measures[ind.id];
          return (
            <div key={ind.id} className="rounded-md border border-ink/10 p-3 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{ind.nom}</div>
                <div className="text-xs text-muted">
                  Unité : {ind.unite || "—"} · Cible : {ind.valeurCible === null ? "—" : `${ind.valeurCible}${ind.unite ? ` ${ind.unite}` : ""}`} · Valeur initiale actuelle :{" "}
                  {ind.valeurInitiale === null ? <span className="text-amber-700">non renseignée</span> : `${ind.valeurInitiale}${ind.unite ? ` ${ind.unite}` : ""}`}
                </div>
              </div>
              {!ind.applicable && <p className="text-sm text-amber-700">Cet établissement n'a pas de copie de l'objectif : la valeur mesurée sera conservée dans l'audit mais ne pourra pas mettre à jour d'indicateur.</p>}
              <div className="flex flex-wrap gap-4 text-sm">
                {AUDIT_RESULTATS.map((r) => (
                  <label key={r} className="flex items-center gap-1.5">
                    <input type="radio" name={`res-${ind.id}`} disabled={dis} checked={m.resultat === r} onChange={() => updM(ind.id, { resultat: r })} />
                    {AUDIT_RESULTAT_LABELS[r]}
                  </label>
                ))}
              </div>
              {m.resultat === "mesuree" && (
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3">
                  <F label={`Valeur initiale mesurée${ind.unite ? ` (${ind.unite})` : ""} *`} hint="0 est une valeur valide ; vide signifie inconnue.">
                    <input className="input" inputMode="decimal" disabled={dis} value={m.valeur} onChange={(e) => updM(ind.id, { valeur: e.target.value })} />
                  </F>
                  <F label="Date de référence de la mesure *">
                    <input type="date" className="input" disabled={dis} value={m.dateReference} onChange={(e) => updM(ind.id, { dateReference: e.target.value })} />
                  </F>
                  <F label="Source de la valeur *">
                    <input className="input" disabled={dis} value={m.source} onChange={(e) => updM(ind.id, { source: e.target.value })} />
                  </F>
                  <F label="Méthode de calcul">
                    <input className="input" disabled={dis} value={m.methodeCalcul} onChange={(e) => updM(ind.id, { methodeCalcul: e.target.value })} />
                  </F>
                </div>
              )}
              {m.resultat !== "non_realisee" && (
                <F label={m.resultat === "indeterminee" ? "Commentaire justificatif * (pourquoi la valeur reste indéterminée)" : "Commentaire justificatif"}>
                  <textarea className="input" rows={2} disabled={dis} value={m.commentaire} onChange={(e) => updM(ind.id, { commentaire: e.target.value })} />
                </F>
              )}
              {m.resultat === "non_realisee" && <p className="text-xs text-muted">La valeur initiale reste inconnue : aucune progression ne sera calculée.</p>}
            </div>
          );
        })}
      </Section>

      <Section n={5} title="Conclusion et actions à engager">
        <div className="grid xl:grid-cols-2 gap-x-4 gap-y-3">
          <F label="Synthèse de l'audit *" className="xl:col-span-2">
            <textarea className="input" rows={3} disabled={dis} value={c.synthese} onChange={(e) => upd({ synthese: e.target.value })} />
          </F>
          <F label="Principaux écarts à traiter">
            <textarea className="input" rows={2} disabled={dis} value={c.principauxEcarts} onChange={(e) => upd({ principauxEcarts: e.target.value })} />
          </F>
          <F label="Recommandations">
            <textarea className="input" rows={2} disabled={dis} value={c.recommandations} onChange={(e) => upd({ recommandations: e.target.value })} />
          </F>
          <F label="Besoin d'actions correctives *">
            <select className="input" disabled={dis} value={c.besoinActions} onChange={(e) => upd({ besoinActions: e.target.value as any })}>
              <option value="">— À préciser —</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </F>
          <F label="Commentaire de validation">
            <input className="input" disabled={dis} value={c.commentaireValidation} onChange={(e) => upd({ commentaireValidation: e.target.value })} />
          </F>
        </div>

        {locked && data.findings.length > 0 && (
          <div>
            <div className="label mb-1">Constats enregistrés et actions de traitement</div>
            <ul className="divide-y divide-ink/5 text-sm">
              {data.findings.map((f) => (
                <li key={f.id} className="py-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs rounded bg-ink/5 px-1.5 py-0.5">{KIND_LABELS[f.type] || f.type}</span>
                  <span className="flex-1 min-w-[12rem]">{f.libelle}</span>
                  {f.actions.length > 0 ? (
                    <span className="text-xs text-teal-700">Action : {f.actions[0].title} · {f.actions[0].status.replace("_", " ")}</span>
                  ) : f.type !== "point_fort" ? (
                    <button type="button" className="text-blue hover:underline text-sm" disabled={busy} onClick={() => createCorrective(f.id)}>
                      Créer l'action corrective
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {errors.length > 0 && (
        <div className="card mb-4 border-bad/40 bg-bad/5 text-sm text-bad">
          <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {info && <div className="card mb-4 text-sm border-teal-200 bg-teal-50/40">{info}</div>}
      {locked && data.suggestClosure && data.action.status !== "termine" && (
        <div className="card mb-4 text-sm flex flex-wrap items-center gap-3">
          <span>Tous les périmètres attendus ont un audit validé : l'action peut être clôturée.</span>
          <button type="button" className="btn" disabled={busy} onClick={closeAction}>
            Marquer l'action comme terminée
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-10">
        {!locked && (
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={saveDraft}>
              Enregistrer le brouillon
            </button>
            <button type="button" className="btn" disabled={busy} onClick={validate}>
              Valider l'audit
            </button>
          </>
        )}
        <Link href="/actions" className="btn-secondary">
          {locked ? "Retour à l'action" : "Annuler / Retour à l'action"}
        </Link>
      </div>
    </div>
  );
}
