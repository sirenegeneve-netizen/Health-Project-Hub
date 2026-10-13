"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/components/projectConfig/api";
import { ScopeFields, type ScopeValue } from "@/components/objectif/ScopeFields";
import { THEMES_INDICATEUR } from "@/lib/referentiels";
import { buildBaselineAction, needsBaseline } from "@/lib/objectifs";

interface Props {
  ownerType: "groupe" | "etablissement";
  ownerId: string;
  plans: { id: string; libelle: string }[];
  actors: { id: string; name: string }[];
  establishmentCount: number;
  establishments?: { id: string; name: string }[]; // objectif de groupe : établissements sélectionnables dans le périmètre
  basePath: string; // ex. /groups/xyz/objectifs
}

interface IndicatorDraft {
  nom: string;
  unite: string;
  sens: string;
  valeurInitiale: string;
  valeurActuelle: string;
  valeurCible: string;
  frequence: string;
  echeance: string;
  theme: string;
  baselineSource: string;
  baselineDate: string;
}

interface ActionDraft {
  title: string;
  description: string;
  responsableActorId: string;
  priority: string;
  echeance: string;
  status: string;
  livrable: string;
  indicatorIndex: string; // "" = aucun, sinon index dans la liste d'indicateurs envoyée
}

const emptyIndicator = (): IndicatorDraft => ({ nom: "", unite: "", sens: "hausse", valeurInitiale: "", valeurActuelle: "", valeurCible: "", frequence: "trimestrielle", echeance: "", theme: "", baselineSource: "", baselineDate: "" });
const emptyAction = (): ActionDraft => ({ title: "", description: "", responsableActorId: "", priority: "normale", echeance: "", status: "a_faire", livrable: "", indicatorIndex: "" });

function Section({ letter, title, hint, children, defaultOpen = true }: { letter: string; title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="card !p-0 mb-4 group">
      <summary className="cursor-pointer select-none px-5 py-3 flex items-center gap-3 list-none">
        <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-xs flex items-center justify-center font-medium">{letter}</span>
        <span className="font-medium text-ink">{title}</span>
        {hint && <span className="text-xs text-muted hidden sm:inline">{hint}</span>}
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-3 border-t border-ink/5">{children}</div>
    </details>
  );
}

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="label mb-1">{label}</div>
      {children}
    </label>
  );
}

// Création complète d'un objectif : identification, résultat attendu, indicateurs, premières actions (facultatives).
// Périmètre, indicateur, valeur initiale et valeur cible sont des champs distincts.
export function ObjectiveCreateForm({ ownerType, ownerId, plans, actors, establishmentCount, establishments, basePath }: Props) {
  const router = useRouter();
  const [f, setF] = useState({
    libelle: "",
    description: "",
    strategicPlanId: plans[0]?.id || "",
    axe: "",
    priorite: "normale",
    responsableActorId: "",
    statut: "actif",
    resultatAttendu: "",
    echeance: "",
  });
  const [scope, setScope] = useState<ScopeValue>({ perimetreOrg: [], populations: [], scopeEstablishmentIds: [], perimetre: "" });
  // État des lieux initial : proposé automatiquement quand un indicateur n'a pas de valeur initiale, modifiable ou refusable.
  const [baseline, setBaseline] = useState({ create: true, title: "", description: "", livrable: "", responsableActorId: "", echeance: "", status: "a_faire" });
  const [main, setMain] = useState<IndicatorDraft>(emptyIndicator());
  const [extras, setExtras] = useState<IndicatorDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [diffuse, setDiffuse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasMain = main.nom.trim().length > 0;
  const indicatorList = [...(hasMain ? [{ ...main, principal: true }] : []), ...extras.filter((i) => i.nom.trim())];
  const unknownBaseline = indicatorList.filter((i) => needsBaseline(i.valeurInitiale));
  const draft = buildBaselineAction({ objectif: f.libelle || "l'objectif", indicators: unknownBaseline.map((i) => ({ nom: i.nom, unite: i.unite })), ownerType });

  async function submit() {
    setError("");
    if (!f.libelle.trim()) return setError("L'intitulé est requis.");
    if (!f.strategicPlanId) return setError("Le plan stratégique est requis.");
    if (!hasMain && (main.valeurInitiale || main.valeurCible || main.valeurActuelle)) return setError("Nommez l'indicateur principal, ou videz ses valeurs.");
    for (const [i, a] of actions.entries()) if (!a.title.trim()) return setError(`Action ${i + 1} : l'intitulé est requis (ou supprimez la ligne).`);

    const toInd = (i: IndicatorDraft & { principal?: boolean }) => ({
      nom: i.nom,
      unite: i.unite || null,
      sens: i.sens,
      valeurInitiale: i.valeurInitiale || null,
      valeurActuelle: i.valeurActuelle || null,
      valeurCible: i.valeurCible || null,
      frequence: i.frequence,
      echeance: i.echeance || null,
      principal: i.principal === true,
      theme: i.theme || null,
      baselineSource: i.baselineSource || null,
      baselineDate: i.baselineDate || null,
    });
    setBusy(true);
    const res = await callApi("POST", "/api/objectives", {
      ownerType,
      ownerId,
      ...f,
      perimetre: scope.perimetre || null,
      perimetreOrg: scope.perimetreOrg,
      populations: scope.populations,
      scopeEstablishmentIds: scope.scopeEstablishmentIds,
      baselineAction:
        unknownBaseline.length > 0 && baseline.create
          ? {
              create: true,
              title: baseline.title.trim() || draft.title,
              description: baseline.description.trim() || draft.description,
              livrable: baseline.livrable.trim() || draft.livrable,
              responsableActorId: baseline.responsableActorId || null,
              echeance: baseline.echeance || null,
              status: baseline.status,
            }
          : { create: false },
      responsableActorId: f.responsableActorId || null,
      echeance: f.echeance || null,
      diffuse: ownerType === "groupe" && diffuse,
      indicators: indicatorList.map(toInd),
      actions: actions.map((a) => ({
        title: a.title,
        description: a.description || null,
        responsableActorId: a.responsableActorId || null,
        priority: a.priority,
        echeance: a.echeance || null,
        status: a.status,
        livrable: a.livrable || null,
        indicatorIndex: a.indicatorIndex === "" ? null : Number(a.indicatorIndex),
      })),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error || "Erreur.");
    router.push(`${basePath}/${res.data.id}`);
  }

  const upd = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  return (
    <div data-wide-page className="w-full">
      <Section letter="A" title="Identification">
        <F label="Intitulé *">
          <input className="input" value={f.libelle} onChange={(e) => upd({ libelle: e.target.value })} placeholder="Ex. Améliorer la sécurité médicamenteuse" />
        </F>
        <F label="Description / finalité">
          <textarea className="input" rows={3} value={f.description} onChange={(e) => upd({ description: e.target.value })} />
        </F>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
          <F label="Plan stratégique *">
            <select className="input" value={f.strategicPlanId} onChange={(e) => upd({ strategicPlanId: e.target.value })}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                </option>
              ))}
            </select>
          </F>
          <F label="Axe stratégique (si pertinent)">
            <input className="input" value={f.axe} onChange={(e) => upd({ axe: e.target.value })} />
          </F>
          <F label="Priorité">
            <select className="input" value={f.priorite} onChange={(e) => upd({ priorite: e.target.value })}>
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="critique">Critique</option>
            </select>
          </F>
          <F label="Responsable / pilote">
            <select className="input" value={f.responsableActorId} onChange={(e) => upd({ responsableActorId: e.target.value })}>
              <option value="">— Non assigné —</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </F>
          <F label="Statut">
            <select className="input" value={f.statut} onChange={(e) => upd({ statut: e.target.value })}>
              <option value="actif">Actif</option>
              <option value="reporte">Reporté</option>
            </select>
          </F>
        </div>
      </Section>

      <Section letter="B" title="Résultat attendu" hint="périmètre, indicateur, valeurs : champs distincts">
        <F label="Résultat attendu">
          <textarea className="input" rows={2} value={f.resultatAttendu} onChange={(e) => upd({ resultatAttendu: e.target.value })} />
        </F>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4">
          <F label="Échéance de l'objectif">
            <input type="date" className="input" value={f.echeance} onChange={(e) => upd({ echeance: e.target.value })} />
          </F>
        </div>
        <ScopeFields value={scope} onChange={setScope} establishments={ownerType === "groupe" ? establishments : undefined} />
        <div className="rounded-md bg-teal-50/40 p-3 space-y-3">
          <div className="text-xs text-muted">Indicateur principal (optionnel) — il alimente la cible affichée dans la liste des objectifs.</div>
          <IndicatorFields value={main} onChange={setMain} compact />
        </div>
      </Section>

      <Section letter="C" title="Autres indicateurs" hint="facultatif" defaultOpen={false}>
        {extras.map((ind, i) => (
          <div key={i} className="rounded-md border border-ink/10 p-3 space-y-3">
            <IndicatorFields value={ind} onChange={(v) => setExtras(extras.map((x, j) => (j === i ? v : x)))} />
            <button className="text-sm text-bad hover:underline" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>
              Retirer cet indicateur
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setExtras([...extras, emptyIndicator()])}>
          + Ajouter un indicateur
        </button>
      </Section>

      <Section letter="D" title="Premières actions" hint="facultatif — vous pourrez en ajouter à tout moment" defaultOpen={false}>
        {actions.map((a, i) => (
          <div key={i} className="rounded-md border border-ink/10 p-3 space-y-3">
            <F label="Action">
              <input className="input" value={a.title} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Ex. Réaliser un état des lieux du circuit du médicament" />
            </F>
            <F label="Description">
              <textarea className="input" rows={2} value={a.description} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            </F>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <F label="Responsable">
                <select className="input" value={a.responsableActorId} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, responsableActorId: e.target.value } : x)))}>
                  <option value="">— Non assigné —</option>
                  {actors.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac.name}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Priorité">
                <select className="input" value={a.priority} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, priority: e.target.value } : x)))}>
                  <option value="basse">Basse</option>
                  <option value="normale">Normale</option>
                  <option value="haute">Haute</option>
                  <option value="critique">Critique</option>
                </select>
              </F>
              <F label="Échéance">
                <input type="date" className="input" value={a.echeance} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, echeance: e.target.value } : x)))} />
              </F>
              <F label="Statut">
                <select className="input" value={a.status} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))}>
                  <option value="a_faire">À faire</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminée</option>
                </select>
              </F>
              <F label="Livrable / preuve attendue" className="sm:col-span-2">
                <input className="input" value={a.livrable} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, livrable: e.target.value } : x)))} />
              </F>
            </div>
            {indicatorList.length > 0 && (
              <F label="Indicateur associé (si pertinent)">
                <select className="input" value={a.indicatorIndex} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, indicatorIndex: e.target.value } : x)))}>
                  <option value="">— Aucun —</option>
                  {indicatorList.map((ind, k) => (
                    <option key={k} value={k}>
                      {ind.nom}
                    </option>
                  ))}
                </select>
              </F>
            )}
            <button className="text-sm text-bad hover:underline" onClick={() => setActions(actions.filter((_, j) => j !== i))}>
              Retirer cette action
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => setActions([...actions, emptyAction()])}>
          + Ajouter une action
        </button>
      </Section>

      {unknownBaseline.length > 0 && (
        <div className="card mb-4 border-amber-200/70 bg-amber-50/40 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <input id="bl-create" type="checkbox" className="mt-1" checked={baseline.create} onChange={(e) => setBaseline({ ...baseline, create: e.target.checked })} />
            <label htmlFor="bl-create">
              <strong>Valeur initiale non renseignée</strong> pour {unknownBaseline.length === 1 ? "l'indicateur" : `${unknownBaseline.length} indicateurs`} ({unknownBaseline.map((i) => i.nom).join(", ")}). La situation de départ est <em>inconnue</em> — pas égale à zéro — et aucune progression ne sera calculée tant qu'elle n'est pas établie.
              <span className="block text-muted">Une action « État des lieux initial » est proposée. Décochez si un audit ou une mesure fiable existe déjà (renseignez alors la valeur initiale).</span>
            </label>
          </div>
          {baseline.create && (
            <div className="grid lg:grid-cols-2 gap-x-4 gap-y-3">
              <F label="Titre de l'action" className="lg:col-span-2">
                <input className="input" value={baseline.title || draft.title} onChange={(e) => setBaseline({ ...baseline, title: e.target.value })} />
              </F>
              <F label="Description" className="lg:col-span-2">
                <textarea className="input" rows={3} value={baseline.description || draft.description} onChange={(e) => setBaseline({ ...baseline, description: e.target.value })} />
              </F>
              <F label="Résultat attendu / livrable" className="lg:col-span-2">
                <textarea className="input" rows={2} value={baseline.livrable || draft.livrable} onChange={(e) => setBaseline({ ...baseline, livrable: e.target.value })} />
              </F>
              <F label="Responsable">
                <select className="input" value={baseline.responsableActorId} onChange={(e) => setBaseline({ ...baseline, responsableActorId: e.target.value })}>
                  <option value="">— Non assigné —</option>
                  {actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Échéance">
                  <input type="date" className="input" value={baseline.echeance} onChange={(e) => setBaseline({ ...baseline, echeance: e.target.value })} />
                </F>
                <F label="Statut">
                  <select className="input" value={baseline.status} onChange={(e) => setBaseline({ ...baseline, status: e.target.value })}>
                    <option value="a_faire">À faire</option>
                    <option value="en_cours">En cours</option>
                  </select>
                </F>
              </div>
            </div>
          )}
        </div>
      )}

      {ownerType === "groupe" && establishmentCount > 0 && (
        <div className="card mb-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={diffuse} onChange={(e) => setDiffuse(e.target.checked)} />
            <span>
              <strong>Diffuser aux établissements rattachés ({establishmentCount})</strong> — chacun reçoit l'objectif (intitulé verrouillé) et la définition des indicateurs ; il renseigne ses propres valeurs, mesures, cible locale et actions.
            </span>
          </label>
        </div>
      )}

      {error && <p className="text-sm text-bad mb-3">{error}</p>}
      <div className="flex gap-3">
        <button className="btn" disabled={busy} onClick={submit}>
          {busy ? "Création…" : "Créer l'objectif"}
        </button>
        <Link href={basePath} className="btn-secondary">
          Annuler
        </Link>
      </div>
    </div>
  );
}

function IndicatorFields({ value, onChange, compact = false }: { value: IndicatorDraft; onChange: (v: IndicatorDraft) => void; compact?: boolean }) {
  const set = (patch: Partial<IndicatorDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <F label="Indicateur" className="sm:col-span-2">
          <input className="input" value={value.nom} onChange={(e) => set({ nom: e.target.value })} placeholder="Ex. Taux de traçabilité de l'administration" />
        </F>
        <F label="Unité">
          <input className="input" value={value.unite} onChange={(e) => set({ unite: e.target.value })} placeholder="%" />
        </F>
        <F label="Thème de l'indicateur">
          <select className="input" value={value.theme} onChange={(e) => set({ theme: e.target.value })}>
            <option value="">— Non défini —</option>
            {THEMES_INDICATEUR.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </F>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <F label="Sens">
          <select className="input" value={value.sens} onChange={(e) => set({ sens: e.target.value })}>
            <option value="hausse">≥ cible (hausse)</option>
            <option value="baisse">≤ cible (baisse)</option>
          </select>
        </F>
        <F label="Valeur initiale">
          <input className="input" inputMode="decimal" value={value.valeurInitiale} onChange={(e) => set({ valeurInitiale: e.target.value })} placeholder="Inconnue — laisser vide" />
        </F>
        <F label="Valeur actuelle">
          <input className="input" inputMode="decimal" value={value.valeurActuelle} onChange={(e) => set({ valeurActuelle: e.target.value })} />
        </F>
        <F label="Valeur cible">
          <input className="input" inputMode="decimal" value={value.valeurCible} onChange={(e) => set({ valeurCible: e.target.value })} placeholder="98" />
        </F>
      </div>
      {value.valeurInitiale.trim() !== "" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Source de la valeur initiale (facultatif)">
            <input className="input" value={value.baselineSource} onChange={(e) => set({ baselineSource: e.target.value })} placeholder="Ex. audit interne 2025" />
          </F>
          <F label="Date de la mesure initiale">
            <input type="date" className="input" value={value.baselineDate} onChange={(e) => set({ baselineDate: e.target.value })} />
          </F>
        </div>
      )}
      {!compact && (
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Fréquence de mesure">
            <select className="input" value={value.frequence} onChange={(e) => set({ frequence: e.target.value })}>
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
              <option value="semestrielle">Semestrielle</option>
              <option value="annuelle">Annuelle</option>
              <option value="ponctuelle">Ponctuelle</option>
            </select>
          </F>
          <F label="Échéance">
            <input type="date" className="input" value={value.echeance} onChange={(e) => set({ echeance: e.target.value })} />
          </F>
        </div>
      )}
    </div>
  );
}
