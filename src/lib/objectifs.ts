// Objectif = unité de pilotage — logique pure (aucune dépendance Prisma/Next), testée unitairement.
// Philosophie HPH : pas de donnée = pas de faux indicateur. Une progression n'est JAMAIS inventée.

export const INDICATOR_SENS = ["hausse", "baisse"] as const;
export const INDICATOR_FREQUENCES = ["mensuelle", "trimestrielle", "semestrielle", "annuelle", "ponctuelle"] as const;
export const INDICATOR_STATUTS = ["actif", "atteint", "abandonne"] as const;
export const OBJECTIVE_STATUTS = ["actif", "atteint", "abandonne", "reporte"] as const;
export const PRIORITES = ["basse", "normale", "haute", "critique"] as const;
export const LINK_KINDS = ["risque", "decision", "constat", "exigence"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const LINK_NATURES = ["associe", "justifie", "contraint"] as const;
export const CONFORMITE_STATUTS = ["non_evalue", "conforme", "partiellement_conforme", "non_conforme"] as const;

function inList(list: readonly string[], v: unknown): boolean {
  return typeof v === "string" && list.includes(v);
}
export const isSens = (v: unknown) => inList(INDICATOR_SENS, v);
export const isFrequence = (v: unknown) => inList(INDICATOR_FREQUENCES, v);
export const isIndicatorStatut = (v: unknown) => inList(INDICATOR_STATUTS, v);
export const isObjectiveStatut = (v: unknown) => inList(OBJECTIVE_STATUTS, v);
export const isPriorite = (v: unknown) => inList(PRIORITES, v);
export const isLinkKind = (v: unknown): v is LinkKind => inList(LINK_KINDS, v);
export const isLinkNature = (v: unknown) => inList(LINK_NATURES, v);
export const isConformiteStatut = (v: unknown) => inList(CONFORMITE_STATUTS, v);

// --- Mesures ---------------------------------------------------------------------------------------------------

export interface MeasureLite {
  valeur: number;
  dateMesure: Date | string;
  createdAt?: Date | string;
}

const ts = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);

// Valeur actuelle = dernière mesure (par date de mesure, puis par date de saisie). Aucune mesure → null.
export function currentValue(measures: MeasureLite[]): number | null {
  if (measures.length === 0) return null;
  const sorted = [...measures].sort((a, b) => ts(a.dateMesure) - ts(b.dateMesure) || ts(a.createdAt) - ts(b.createdAt));
  return sorted[sorted.length - 1].valeur;
}

// --- Indicateur : héritage de la définition Groupe -------------------------------------------------------------

export const INDICATOR_DEFINITION_FIELDS = ["nom", "description", "unite", "sens", "frequence"] as const;

export interface IndicatorLite {
  nom: string;
  description: string | null;
  unite: string | null;
  sens: string;
  frequence: string;
  valeurInitiale: number | null;
  valeurCible: number | null;
  statut?: string;
}

// Indicateur effectif d'un établissement : définition = celle du Groupe ; cible = cible locale si renseignée,
// sinon cible du Groupe. Sans parent (indicateur propre ou du groupe), l'indicateur est retourné tel quel.
export function effectiveIndicator<T extends IndicatorLite>(ind: T, parent: IndicatorLite | null | undefined): T & { cibleHeritee: boolean; cibleLocale: boolean } {
  if (!parent) return { ...ind, cibleHeritee: false, cibleLocale: false };
  const local = ind.valeurCible !== null && ind.valeurCible !== undefined;
  return {
    ...ind,
    nom: parent.nom,
    description: parent.description,
    unite: parent.unite,
    sens: parent.sens,
    frequence: parent.frequence,
    valeurCible: local ? ind.valeurCible : parent.valeurCible,
    cibleHeritee: !local,
    cibleLocale: local && ind.valeurCible !== parent.valeurCible,
  };
}

// Champs de définition qu'un établissement ne peut pas modifier sur un indicateur hérité.
export function lockedIndicatorFields(isInherited: boolean, body: Record<string, unknown>): string[] {
  if (!isInherited) return [];
  return INDICATOR_DEFINITION_FIELDS.filter((f) => body[f] !== undefined);
}

// --- Progression -----------------------------------------------------------------------------------------------

// Progression d'un indicateur, 0–1. null tant qu'on ne peut pas la calculer honnêtement : il faut une valeur
// initiale, une valeur cible différente de la valeur initiale, et au moins une mesure. Vaut à la hausse comme
// à la baisse ((actuelle − initiale) / (cible − initiale)), bornée à [0 ; 1].
export function indicatorProgress(input: { valeurInitiale: number | null; valeurCible: number | null; actuelle: number | null }): number | null {
  const { valeurInitiale: i, valeurCible: c, actuelle: a } = input;
  if (i === null || c === null || a === null || i === undefined || c === undefined || a === undefined) return null;
  if (c === i) return null;
  const p = (a - i) / (c - i);
  return Math.min(1, Math.max(0, p));
}

export interface ProgressResult {
  percent: number | null; // 0–100, null = « — »
  basis: "indicateurs" | "actions" | null;
  measured: number; // indicateurs mesurés (basis indicateurs) ou actions terminées (basis actions)
  total: number; // indicateurs définis ou actions prises en compte
}

// Règle de progression d'un objectif (validée) :
//  - au moins un indicateur défini → moyenne des indicateurs mesurables ; aucun mesurable → « — »
//    (jamais de repli sur les actions : un indicateur sans mesure ne doit pas être masqué par un autre chiffre) ;
//  - aucun indicateur → actions terminées / actions non abandonnées ; aucune action → « — ».
export function objectiveProgress(input: { indicators: { progress: number | null; statut?: string }[]; actions: { status: string }[] }): ProgressResult {
  const indicators = input.indicators.filter((i) => i.statut !== "abandonne");
  if (indicators.length > 0) {
    const measurable = indicators.filter((i) => i.progress !== null) as { progress: number }[];
    if (measurable.length === 0) return { percent: null, basis: "indicateurs", measured: 0, total: indicators.length };
    const mean = measurable.reduce((s, i) => s + i.progress, 0) / measurable.length;
    return { percent: Math.round(mean * 100), basis: "indicateurs", measured: measurable.length, total: indicators.length };
  }
  const counted = input.actions.filter((a) => a.status !== "abandonne");
  if (counted.length === 0) return { percent: null, basis: null, measured: 0, total: 0 };
  const done = counted.filter((a) => a.status === "termine").length;
  return { percent: Math.round((done / counted.length) * 100), basis: "actions", measured: done, total: counted.length };
}

// Objectif de groupe diffusé : moyenne des établissements mesurés (ceux dont la progression est calculable).
export function rollupProgress(children: { percent: number | null }[]): { percent: number | null; measured: number; total: number } {
  const measurable = children.filter((c) => c.percent !== null) as { percent: number }[];
  if (measurable.length === 0) return { percent: null, measured: 0, total: children.length };
  return { percent: Math.round(measurable.reduce((s, c) => s + c.percent, 0) / measurable.length), measured: measurable.length, total: children.length };
}

export function formatProgress(p: { percent: number | null }): string {
  return p.percent === null ? "—" : `${p.percent} %`;
}

// Cible affichée sur une carte d'objectif : « ≥ 98 % » / « ≤ 2 % » à partir de l'indicateur principal.
export function formatTarget(ind: { valeurCible: number | null; sens: string; unite: string | null } | null | undefined): string | null {
  if (!ind || ind.valeurCible === null || ind.valeurCible === undefined) return null;
  const symbol = ind.sens === "baisse" ? "≤" : "≥";
  const unit = ind.unite ? (ind.unite === "%" ? " %" : ` ${ind.unite}`) : "";
  return `${symbol} ${String(ind.valeurCible).replace(".", ",")}${unit}`;
}

// --- Déclinaisons : rattachement explicite au cycle parent --------------------------------------------------------

export function resolveParentCycleId(
  child: { goalParentId: string | null; planParentId: string | null },
  groupCycles: { id: string; goalId: string; planId: string }[]
): string | null {
  if (!child.goalParentId || !child.planParentId) return null;
  const found = groupCycles.filter((c) => c.goalId === child.goalParentId && c.planId === child.planParentId);
  return found.length === 1 ? found[0].id : null; // ambigu ou introuvable : on ne devine pas
}

// --- Applicabilité des exigences ---------------------------------------------------------------------------------

export interface ApplicabilityRow {
  establishmentId: string;
  applicable: boolean;
}

// « tous » : tout le groupe sauf les exclusions explicites ; « selection » : seulement les établissements
// explicitement retenus. L'exigence n'est jamais dupliquée : seules ces lignes d'applicabilité varient.
export function applicableEstablishmentIds(portee: string, rows: ApplicabilityRow[], allEstablishmentIds: string[]): string[] {
  if (portee === "selection") {
    const retained = new Set(rows.filter((r) => r.applicable).map((r) => r.establishmentId));
    return allEstablishmentIds.filter((id) => retained.has(id));
  }
  const excluded = new Set(rows.filter((r) => !r.applicable).map((r) => r.establishmentId));
  return allEstablishmentIds.filter((id) => !excluded.has(id));
}

// Conformité consolidée d'une exigence sur ses établissements applicables.
export function conformiteSummary(statuts: string[]): { total: number; conforme: number; nonConforme: number; partiel: number; nonEvalue: number } {
  return {
    total: statuts.length,
    conforme: statuts.filter((s) => s === "conforme").length,
    nonConforme: statuts.filter((s) => s === "non_conforme").length,
    partiel: statuts.filter((s) => s === "partiellement_conforme").length,
    nonEvalue: statuts.filter((s) => s === "non_evalue").length,
  };
}

// --- Validation de la création d'un objectif -----------------------------------------------------------------------

export interface IndicatorInput {
  nom: string;
  description?: string | null;
  unite?: string | null;
  sens?: string;
  valeurInitiale?: number | string | null;
  valeurActuelle?: number | string | null;
  valeurCible?: number | string | null;
  frequence?: string;
  echeance?: string | null;
  responsable?: string | null;
  statut?: string;
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

// Renvoie la liste des erreurs de saisie (vide = valide).
export function validateObjectiveInput(body: any): string[] {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return ["Requête invalide."];
  if (!String(body.libelle || "").trim()) errors.push("L'intitulé est requis.");
  if (!body.strategicPlanId) errors.push("Le plan stratégique est requis.");
  if (body.priorite !== undefined && !isPriorite(body.priorite)) errors.push("Priorité invalide.");
  if (body.statut !== undefined && !isObjectiveStatut(body.statut)) errors.push("Statut invalide.");
  const indicators: IndicatorInput[] = Array.isArray(body.indicators) ? body.indicators : [];
  indicators.forEach((ind, i) => {
    const n = `Indicateur ${i + 1}`;
    if (!String(ind?.nom || "").trim()) errors.push(`${n} : le nom est requis.`);
    if (ind?.sens !== undefined && !isSens(ind.sens)) errors.push(`${n} : sens invalide.`);
    if (ind?.frequence !== undefined && !isFrequence(ind.frequence)) errors.push(`${n} : fréquence invalide.`);
    if (ind?.statut !== undefined && !isIndicatorStatut(ind.statut)) errors.push(`${n} : statut invalide.`);
    for (const f of ["valeurInitiale", "valeurActuelle", "valeurCible"] as const) {
      if (Number.isNaN(toNumberOrNull((ind as any)?.[f]))) errors.push(`${n} : ${f} doit être un nombre.`);
    }
  });
  const actions: { title?: string; indicatorIndex?: number | null }[] = Array.isArray(body.actions) ? body.actions : [];
  actions.forEach((a, i) => {
    if (!String(a?.title || "").trim()) errors.push(`Action ${i + 1} : l'intitulé est requis.`);
    if (a?.indicatorIndex !== undefined && a?.indicatorIndex !== null && (typeof a.indicatorIndex !== "number" || a.indicatorIndex < 0 || a.indicatorIndex >= indicators.length)) {
      errors.push(`Action ${i + 1} : indicateur associé introuvable.`);
    }
  });
  return errors;
}
