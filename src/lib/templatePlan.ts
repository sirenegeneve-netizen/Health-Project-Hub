// Logique pure du moteur de modèles (aucune dépendance Prisma/Next) — testable seule.

export interface PlanCriterionIn {
  label: string;
  order: number;
  obligatoire: boolean;
  mode: string;
  autoSource: string | null;
}

export interface PlanStageIn {
  id: string;
  position: number;
  key: string;
  label: string;
  objectif: string | null;
  obligatoire: boolean;
  active: boolean;
  legacyPhases: string[];
  gateMode: string | null;
  criteria: PlanCriterionIn[];
  items?: { kind: string; label: string; order: number; obligatoire: boolean }[];
}

export interface InstanceStagePlan {
  templateStageId: string;
  key: string;
  label: string;
  objectif: string | null;
  position: number;
  obligatoire: boolean;
  legacyPhases: string[];
  gateMode: string | null;
  criteria: { label: string; order: number; obligatoire: boolean; mode: string; autoSource: string | null }[];
  expected: { kind: string; label: string; obligatoire: boolean }[];
}

// Parcours figé d'une initiative : étapes actives du modèle, dans l'ordre, repositionnées de 0 à n-1.
// La phase initiale est la première étape active.
export function planInstance(stages: PlanStageIn[]): { stages: InstanceStagePlan[]; firstPhase: string | null } {
  const active = stages.filter((s) => s.active).sort((a, b) => a.position - b.position);
  const plan = active.map((s, i) => ({
    templateStageId: s.id,
    key: s.key,
    label: s.label,
    objectif: s.objectif,
    position: i,
    obligatoire: s.obligatoire,
    legacyPhases: s.legacyPhases,
    gateMode: s.gateMode,
    criteria: [...s.criteria]
      .sort((a, b) => a.order - b.order)
      .map((c, order) => ({ label: c.label, order, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })),
    expected: [...(s.items ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((it) => ({ kind: it.kind, label: it.label, obligatoire: it.obligatoire })),
  }));
  return { stages: plan, firstPhase: plan[0]?.key ?? null };
}

export interface TemplateLite {
  id: string;
  typeKey: string;
  familyId: string;
  name: string;
  version: number;
  status: string;
  isGeneral: boolean;
}

// Modèles proposés à la création d'une initiative d'un type donné : uniquement les versions
// actives (une par famille). Un seul → sélection automatique. Aucun → repli sur le Modèle général.
export function templateOptionsForType(all: TemplateLite[], typeKey: string): { options: TemplateLite[]; autoSelectedId: string | null; fallbackGeneralId: string | null } {
  const byFamily = new Map<string, TemplateLite>();
  for (const t of all) {
    if (t.status !== "actif" || t.isGeneral || t.typeKey !== typeKey) continue;
    const cur = byFamily.get(t.familyId);
    if (!cur || t.version > cur.version) byFamily.set(t.familyId, t);
  }
  const options = [...byFamily.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const general = all.find((t) => t.isGeneral && t.status === "actif");
  return {
    options,
    autoSelectedId: options.length === 1 ? options[0].id : null,
    fallbackGeneralId: options.length === 0 ? general?.id ?? null : null,
  };
}

// Un modèle utilisé par des initiatives n'est jamais modifié rétroactivement : on crée une nouvelle version.
export function canEditInPlace(template: { status: string }, usageCount: number): boolean {
  if (usageCount > 0) return false;
  return template.status === "brouillon" || template.status === "actif";
}

export function nextVersion(versions: number[]): number {
  return versions.length ? Math.max(...versions) + 1 : 1;
}

// Déplace un élément d'une liste ordonnée de ids ; renvoie le nouvel ordre (ou null si impossible).
export function moveInOrder(ids: string[], id: string, direction: "up" | "down"): string[] | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function slugifyKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// Clé unique dans un ensemble (ajoute _2, _3… si la clé existe déjà).
export function uniqueKey(base: string, existing: Set<string>): string {
  const root = base || "etape";
  if (!existing.has(root)) return root;
  let n = 2;
  while (existing.has(`${root}_${n}`)) n++;
  return `${root}_${n}`;
}

// Gate : évaluation d'un passage à l'étape suivante (consultatif par défaut, bloquant en option).
export function evaluateStageExit(
  gateMode: string | null,
  criteria: { obligatoire: boolean; status: string }[]
): { unmet: number; allowed: boolean; warning: boolean } {
  const unmet = criteria.filter((c) => c.obligatoire && c.status !== "pret").length;
  if (unmet === 0) return { unmet, allowed: true, warning: false };
  if (gateMode === "bloquant") return { unmet, allowed: false, warning: true };
  return { unmet, allowed: true, warning: true };
}

// ============================================================================
// Lot 2 — éléments attendus, sources automatiques, Gates
// ============================================================================

export const ITEM_KINDS = ["livrable", "action", "decision", "risque", "indicateur", "role", "information"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  livrable: "Livrable",
  action: "Action",
  decision: "Décision",
  risque: "Risque type",
  indicateur: "Indicateur",
  role: "Rôle",
  information: "Information attendue",
};

export function isItemKind(v: unknown): v is ItemKind {
  return typeof v === "string" && (ITEM_KINDS as readonly string[]).includes(v);
}

// Types d'éléments suivis par un objet HPH réel (Deliverable, Action, Decision, Risk, Kpi).
// « rôle » et « information » sont purement descriptifs : aucun objet, aucun état.
export const TRACKED_KINDS: ItemKind[] = ["livrable", "action", "decision", "risque", "indicateur"];

export interface ExpectedItem {
  kind: ItemKind;
  label: string;
  obligatoire: boolean;
}

export interface TaggedObject {
  label: string;
  status: string;
}

// Un élément attendu est « satisfait » quand l'objet HPH correspondant (même libellé, rattaché à l'étape)
// a atteint l'état final de son type. Risque et indicateur : l'objet existe (le risque type a été évalué /
// l'indicateur renseigné).
export function isObjectSatisfying(kind: ItemKind, status: string): boolean {
  switch (kind) {
    case "livrable":
      return status === "valide";
    case "action":
      return status === "termine";
    case "decision":
      return status === "decision_prise";
    case "risque":
    case "indicateur":
      return true;
    default:
      return false;
  }
}

export type ExpectedState = "missing" | "in_progress" | "done" | "untracked";

export function expectedItemState(item: ExpectedItem, tagged: TaggedObject[]): ExpectedState {
  if (!TRACKED_KINDS.includes(item.kind)) return "untracked";
  const norm = (s: string) => s.trim().toLowerCase();
  const found = tagged.filter((t) => norm(t.label) === norm(item.label));
  if (found.length === 0) return "missing";
  return found.some((t) => isObjectSatisfying(item.kind, t.status)) ? "done" : "in_progress";
}

// --- Sources automatiques de critères ----------------------------------------------------

export interface StageFacts {
  openBlockingRisks: number; // risques forte/critique non maîtrisés ni clos
  blockingAnomalies: number; // anomalies majeure/critique ni corrigées ni validées
  overdueActions: number;
  requiredDeliverablesMissing: number; // livrables obligatoires attendus non validés
  requiredDecisionsMissing: number;
  requiredActionsMissing: number;
}

export const AUTO_SOURCES = {
  "risks.noBlockingOpen": { label: "Aucun risque bloquant ouvert", test: (f: StageFacts) => f.openBlockingRisks === 0 },
  "anomalies.noBlockingOpen": { label: "Aucune anomalie bloquante ouverte", test: (f: StageFacts) => f.blockingAnomalies === 0 },
  "actions.noneOverdue": { label: "Aucune action en retard", test: (f: StageFacts) => f.overdueActions === 0 },
  "stage.deliverablesReady": { label: "Livrables obligatoires de l'étape validés", test: (f: StageFacts) => f.requiredDeliverablesMissing === 0 },
  "stage.decisionsTaken": { label: "Décisions obligatoires de l'étape prises", test: (f: StageFacts) => f.requiredDecisionsMissing === 0 },
  "stage.actionsDone": { label: "Actions obligatoires de l'étape terminées", test: (f: StageFacts) => f.requiredActionsMissing === 0 },
} as const;

export type AutoSourceKey = keyof typeof AUTO_SOURCES;

export function isAutoSource(v: unknown): v is AutoSourceKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(AUTO_SOURCES, v);
}

export function evaluateAutoSource(source: string, facts: StageFacts): boolean | null {
  return isAutoSource(source) ? AUTO_SOURCES[source].test(facts) : null;
}

// Statut d'un critère automatique / hybride après évaluation de sa source.
//  - manuel   : jamais touché ;
//  - auto     : suit la source (prêt si satisfaite ; sinon un « prêt » repasse « en cours ») ;
//  - hybride  : la source peut seulement faire passer à « prêt » un critère non commencé / en cours ;
//               rien n'est rétrogradé, et un « bloqué » posé à la main reste bloqué.
export function nextCriterionStatus(mode: string, current: string, met: boolean | null): string {
  if (met === null || (mode !== "auto" && mode !== "hybride")) return current;
  if (mode === "hybride") return met && (current === "non_commence" || current === "en_cours") ? "pret" : current;
  if (current === "bloque") return current;
  if (met) return "pret";
  return current === "pret" ? "en_cours" : current;
}

// --- Gate ------------------------------------------------------------------------------------

export type GateOutcome = "go" | "go_reserves" | "no_go";
export const GATE_OUTCOMES: GateOutcome[] = ["go", "go_reserves", "no_go"];
export const GATE_OUTCOME_LABELS: Record<GateOutcome, string> = { go: "GO", go_reserves: "GO avec réserves", no_go: "NO GO" };

export function isGateOutcome(v: unknown): v is GateOutcome {
  return typeof v === "string" && (GATE_OUTCOMES as string[]).includes(v);
}

export interface GateCondition {
  key: string;
  label: string;
  met: boolean;
  detail?: string;
}

export interface GateEvaluation {
  conditions: GateCondition[];
  unmet: number;
  mode: "aucun" | "consultatif" | "bloquant";
  // Passage autorisé à l'étape suivante : toujours si conditions réunies ; sinon seulement hors mode bloquant.
  allowed: boolean;
  warning: boolean;
}

// Conditions d'un Gate (§10 de la spécification) : critères obligatoires satisfaits ; aucun risque bloquant
// ouvert ; livrables obligatoires disponibles ; décisions obligatoires prises.
export function evaluateGate(input: {
  gateMode: string | null;
  criteria: { obligatoire: boolean; status: string }[];
  facts: StageFacts;
}): GateEvaluation {
  const unmetCriteria = input.criteria.filter((c) => c.obligatoire && c.status !== "pret").length;
  const f = input.facts;
  const conditions: GateCondition[] = [
    { key: "criteres", label: "Critères obligatoires satisfaits", met: unmetCriteria === 0, detail: unmetCriteria ? `${unmetCriteria} restant${unmetCriteria > 1 ? "s" : ""}` : undefined },
    { key: "risques", label: "Aucun risque bloquant ouvert", met: f.openBlockingRisks === 0, detail: f.openBlockingRisks ? `${f.openBlockingRisks} ouvert${f.openBlockingRisks > 1 ? "s" : ""}` : undefined },
    { key: "livrables", label: "Livrables obligatoires disponibles", met: f.requiredDeliverablesMissing === 0, detail: f.requiredDeliverablesMissing ? `${f.requiredDeliverablesMissing} manquant${f.requiredDeliverablesMissing > 1 ? "s" : ""}` : undefined },
    { key: "decisions", label: "Décisions obligatoires prises", met: f.requiredDecisionsMissing === 0, detail: f.requiredDecisionsMissing ? `${f.requiredDecisionsMissing} en attente` : undefined },
  ];
  const unmet = conditions.filter((c) => !c.met).length;
  const mode = input.gateMode === "bloquant" ? "bloquant" : input.gateMode === "consultatif" ? "consultatif" : "aucun";
  return { conditions, unmet, mode, allowed: unmet === 0 || mode !== "bloquant", warning: unmet > 0 };
}

// Une décision de Gate fait-elle avancer l'initiative ? GO et GO avec réserves oui, NO GO non.
// En mode bloquant, aucun passage (GO ou réserves) tant que des conditions ne sont pas réunies.
export function gateDecisionAllowed(outcome: GateOutcome, evaluation: GateEvaluation): { ok: boolean; advance: boolean; reason?: string } {
  if (outcome === "no_go") return { ok: true, advance: false };
  if (!evaluation.allowed) return { ok: false, advance: false, reason: "Gate bloquant : les conditions de passage ne sont pas toutes réunies." };
  return { ok: true, advance: true };
}

// Garde du changement de phase : on ne bloque que le passage « en avant » depuis une étape dont le Gate est bloquant.
export function phaseChangeAllowed(opts: {
  orderedKeys: string[];
  fromKey: string | null;
  toKey: string;
  fromGateMode: string | null;
  evaluation: GateEvaluation;
}): boolean {
  if (opts.fromGateMode !== "bloquant" || !opts.fromKey) return true;
  const from = opts.orderedKeys.indexOf(opts.fromKey);
  const to = opts.orderedKeys.indexOf(opts.toKey);
  if (from < 0 || to < 0 || to <= from) return true;
  return opts.evaluation.allowed;
}

export function nextStageKey(orderedKeys: string[], currentKey: string): string | null {
  const i = orderedKeys.indexOf(currentKey);
  return i >= 0 && i < orderedKeys.length - 1 ? orderedKeys[i + 1] : null;
}
