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
