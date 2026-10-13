// Audit de départ (état des lieux initial) — logique pure (aucune dépendance Prisma/Next), testée unitairement.
// Philosophie HPH : une valeur inconnue n'est jamais assimilée à zéro ; la valeur initiale n'est mise à jour qu'à la validation.

export const BASELINE_ACTION_ORIGIN = "etat_des_lieux";
export const GLOBAL_SCOPE = "global";

export const AUDIT_METHODES = [
  { code: "revue_documentaire", label: "Revue documentaire" },
  { code: "analyse_donnees", label: "Analyse de données" },
  { code: "entretiens", label: "Entretiens" },
  { code: "observation", label: "Observation" },
  { code: "tests", label: "Tests" },
  { code: "audit_interne", label: "Audit interne" },
  { code: "autre", label: "Autre" },
] as const;

export const AUDIT_RESULTATS = ["mesuree", "indeterminee", "non_realisee"] as const;
export type AuditResultat = (typeof AUDIT_RESULTATS)[number];
export const AUDIT_RESULTAT_LABELS: Record<AuditResultat, string> = {
  mesuree: "Valeur mesurée",
  indeterminee: "Évaluation réalisée, valeur indéterminée",
  non_realisee: "Audit non réalisé",
};

export const FINDING_KINDS = ["point_fort", "ecart", "observation"] as const;
export const RISK_LEVELS = ["faible", "moyenne", "forte", "critique"] as const;

export const isBaselineAction = (a: { origine?: string | null }): boolean => a.origine === BASELINE_ACTION_ORIGIN;
export const scopeKeyOf = (establishmentId?: string | null): string => (establishmentId ? establishmentId : GLOBAL_SCOPE);

export interface AuditFindingItem {
  type: (typeof FINDING_KINDS)[number];
  libelle: string;
  description: string;
}
export interface AuditRiskItem {
  description: string;
  criticite: (typeof RISK_LEVELS)[number];
}
export interface AuditContenu {
  personnesConsultees: string;
  perimetreAudite: string;
  methodes: string[];
  referentiel: string;
  periodeReference: string;
  sources: string;
  situationExistante: string;
  constats: AuditFindingItem[];
  risques: AuditRiskItem[];
  limites: string;
  commentaires: string;
  pieces: string;
  synthese: string;
  principauxEcarts: string;
  recommandations: string;
  besoinActions: "" | "oui" | "non";
  commentaireValidation: string;
  // Renseignés par le serveur uniquement (jamais repris du client) : traçabilité vers les constats / risques créés.
  findingIds?: string[];
  riskIds?: (string | null)[];
}

export const emptyContenu = (): AuditContenu => ({
  personnesConsultees: "", perimetreAudite: "", methodes: [], referentiel: "", periodeReference: "", sources: "",
  situationExistante: "", constats: [], risques: [], limites: "", commentaires: "", pieces: "",
  synthese: "", principauxEcarts: "", recommandations: "", besoinActions: "", commentaireValidation: "",
});

const str = (v: unknown, max = 8000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Liste blanche : seuls les champs connus sont conservés, textes bornés.
export function sanitizeContenu(raw: unknown, previous?: Partial<AuditContenu> | null): AuditContenu {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const known = new Set<string>(AUDIT_METHODES.map((m) => m.code));
  const constats: AuditFindingItem[] = (Array.isArray(r.constats) ? r.constats : [])
    .slice(0, 100)
    .map((c: any) => ({ type: (FINDING_KINDS as readonly string[]).includes(c?.type) ? c.type : "observation", libelle: str(c?.libelle, 300), description: str(c?.description) }));
  const risques: AuditRiskItem[] = (Array.isArray(r.risques) ? r.risques : [])
    .slice(0, 100)
    .map((k: any) => ({ description: str(k?.description, 1000), criticite: (RISK_LEVELS as readonly string[]).includes(k?.criticite) ? k.criticite : "moyenne" }));
  return {
    personnesConsultees: str(r.personnesConsultees), perimetreAudite: str(r.perimetreAudite),
    methodes: Array.from(new Set((Array.isArray(r.methodes) ? r.methodes : []).filter((m: unknown) => typeof m === "string" && known.has(m)))) as string[],
    referentiel: str(r.referentiel), periodeReference: str(r.periodeReference), sources: str(r.sources),
    situationExistante: str(r.situationExistante), constats, risques,
    limites: str(r.limites), commentaires: str(r.commentaires), pieces: str(r.pieces),
    synthese: str(r.synthese), principauxEcarts: str(r.principauxEcarts), recommandations: str(r.recommandations),
    besoinActions: r.besoinActions === "oui" || r.besoinActions === "non" ? r.besoinActions : "",
    commentaireValidation: str(r.commentaireValidation),
    findingIds: previous?.findingIds, riskIds: previous?.riskIds,
  };
}

export interface AuditMeasureInput {
  goalIndicatorId: string;
  resultat: AuditResultat;
  valeur: number | null;
  dateReference: string | null;
  methodeCalcul: string;
  source: string;
  commentaire: string;
}

// Nombre ou null : une chaîne vide / absente reste null, JAMAIS 0. NaN signale une saisie invalide.
export function parseMeasureValue(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

export function sanitizeMeasures(raw: unknown, allowedIndicatorIds: string[]): { measures: AuditMeasureInput[]; errors: string[] } {
  const errors: string[] = [];
  const out = new Map<string, AuditMeasureInput>();
  for (const m of Array.isArray(raw) ? raw : []) {
    if (!m || !allowedIndicatorIds.includes(m.goalIndicatorId)) continue;
    const resultat: AuditResultat = (AUDIT_RESULTATS as readonly string[]).includes(m.resultat) ? m.resultat : "non_realisee";
    const valeur = parseMeasureValue(m.valeur);
    if (Number.isNaN(valeur)) errors.push("La valeur mesurée doit être un nombre.");
    out.set(m.goalIndicatorId, {
      goalIndicatorId: m.goalIndicatorId,
      resultat,
      // une valeur n'a de sens que pour « mesurée » : on ne garde jamais un chiffre sur une évaluation indéterminée
      valeur: resultat === "mesuree" && valeur !== null && !Number.isNaN(valeur) ? valeur : null,
      dateReference: typeof m.dateReference === "string" && m.dateReference ? m.dateReference : null,
      methodeCalcul: str(m.methodeCalcul, 2000), source: str(m.source, 1000), commentaire: str(m.commentaire, 4000),
    });
  }
  return { measures: allowedIndicatorIds.map((id) => out.get(id)).filter((x): x is AuditMeasureInput => !!x), errors };
}

export interface AuditToValidate {
  dateRealisation: string | null;
  auditeur: string | null;
  contenu: AuditContenu;
  measures: AuditMeasureInput[];
  indicatorIds: string[];
}

// Règles de validation : la valeur initiale n'est mise à jour que si la mesure est suffisamment documentée.
export function validateAuditForValidation(a: AuditToValidate): string[] {
  const e: string[] = [];
  if (!a.dateRealisation) e.push("La date de réalisation de l'audit est requise.");
  if (!str(a.auditeur)) e.push("L'auditeur / responsable de l'évaluation est requis.");
  if (!a.contenu.synthese) e.push("La synthèse de l'audit est requise.");
  if (!a.contenu.besoinActions) e.push("Indiquez s'il y a un besoin d'actions correctives (oui / non).");
  a.contenu.constats.forEach((c, i) => { if (!c.libelle) e.push(`Constat ${i + 1} : l'intitulé est requis (ou supprimez la ligne).`); });
  a.contenu.risques.forEach((r, i) => { if (!r.description) e.push(`Risque ${i + 1} : la description est requise (ou supprimez la ligne).`); });
  const byId = new Map(a.measures.map((m) => [m.goalIndicatorId, m]));
  let evaluated = 0;
  for (const id of a.indicatorIds) {
    const m = byId.get(id);
    if (!m || m.resultat === "non_realisee") continue;
    evaluated++;
    if (m.resultat === "mesuree") {
      if (m.valeur === null) e.push("Valeur mesurée : une valeur numérique est requise (0 est valide, vide ne l'est pas).");
      if (!m.dateReference) e.push("Valeur mesurée : la date de référence est requise.");
      if (!m.source) e.push("Valeur mesurée : la source est requise.");
      if (!m.methodeCalcul && !m.commentaire) e.push("Valeur mesurée : précisez la méthode de calcul ou un commentaire justificatif.");
    } else if (!m.commentaire) {
      e.push("Valeur indéterminée : expliquez pourquoi dans le commentaire justificatif.");
    }
  }
  if (a.indicatorIds.length > 0 && evaluated === 0) e.push("Aucun indicateur n'a été évalué : conservez l'audit en brouillon tant qu'il n'est pas réalisé.");
  return e;
}

// --- Consolidation multi-établissements (sans agrégation de valeurs) ------------------------------------------------

export type ScopeAuditStatus = "non_evalue" | "brouillon" | "evalue_sans_resultat" | "mesure_validee";
export interface ConsolidationRow {
  establishmentId: string;
  name: string;
  status: ScopeAuditStatus;
}

export function scopeAuditStatus(audit: { statut: string; measures: { resultat: string }[] } | null | undefined): ScopeAuditStatus {
  if (!audit) return "non_evalue";
  if (audit.statut !== "valide") return "brouillon";
  if (audit.measures.some((m) => m.resultat === "mesuree")) return "mesure_validee";
  if (audit.measures.some((m) => m.resultat === "indeterminee")) return "evalue_sans_resultat";
  return "non_evalue";
}

// Aucune valeur n'est agrégée ici : pas de règle de calcul universelle (moyenne, somme, taux pondéré…) pour un indicateur.
// On ne fait que dire où en est chaque établissement, et ce qui manque.
export function consolidateAudits(
  establishments: { id: string; name: string }[],
  audits: { establishmentId: string | null; statut: string; measures: { resultat: string }[] }[]
): { rows: ConsolidationRow[]; counts: Record<ScopeAuditStatus, number>; total: number } {
  const byEst = new Map(audits.filter((a) => a.establishmentId).map((a) => [a.establishmentId as string, a]));
  const rows = establishments.map((e) => ({ establishmentId: e.id, name: e.name, status: scopeAuditStatus(byEst.get(e.id)) }));
  const counts: Record<ScopeAuditStatus, number> = { non_evalue: 0, brouillon: 0, evalue_sans_resultat: 0, mesure_validee: 0 };
  rows.forEach((r) => counts[r.status]++);
  return { rows, counts, total: rows.length };
}

// L'action peut être proposée à la clôture quand tous les périmètres attendus ont un audit validé.
// Ce n'est qu'une suggestion : la clôture reste un geste explicite (jamais déclenchée par l'ouverture du formulaire).
export function canSuggestClosure(expectedScopeKeys: string[], audits: { scopeKey: string; statut: string }[]): boolean {
  if (expectedScopeKeys.length === 0) return false;
  const validated = new Set(audits.filter((a) => a.statut === "valide").map((a) => a.scopeKey));
  return expectedScopeKeys.every((k) => validated.has(k));
}

export function correctiveActionDraft(finding: { libelle: string; description?: string | null }): { title: string; comments: string | null } {
  return { title: `Traiter l'écart : ${finding.libelle}`.slice(0, 300), comments: finding.description || null };
}
