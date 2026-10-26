// Déclinaison d'un objectif du groupe dans un établissement — règles PURES (aucune dépendance Prisma/Next), testées.
// Principes : rien n'est écrasé sans décision explicite ; un établissement sorti du périmètre est conservé (« Hors périmètre ») ;
// l'état de mise en œuvre est déclaré par l'établissement, jamais déduit des seules actions.

export const DECLINAISON_ETATS = ["non_pris_en_charge", "pris_en_charge", "en_cours", "termine", "non_applicable", "hors_perimetre"] as const;
export type DeclinaisonEtat = (typeof DECLINAISON_ETATS)[number];
export const ETAT_LABELS: Record<DeclinaisonEtat, string> = {
  non_pris_en_charge: "Non pris en charge",
  pris_en_charge: "Pris en charge",
  en_cours: "En cours",
  termine: "Terminé",
  non_applicable: "Non applicable (dérogation validée)",
  hors_perimetre: "Hors périmètre",
};
export const isEtat = (v: unknown): v is DeclinaisonEtat => typeof v === "string" && (DECLINAISON_ETATS as readonly string[]).includes(v);

export type StateAction = "prendre_en_charge" | "annuler_prise_en_charge" | "demarrer" | "terminer" | "rouvrir";
export type Outcome<T> = { ok: boolean; value?: T; error?: string };
const fail = <T>(error: string): Outcome<T> => ({ ok: false, error });

// Transitions déclarées par l'établissement.
export function applyStateAction(state: string | null, derogationStatut: string | null, action: StateAction): Outcome<DeclinaisonEtat> {
  const s: DeclinaisonEtat = isEtat(state) ? state : "non_pris_en_charge";
  if (s === "hors_perimetre") return fail("Cet établissement n'est plus dans le périmètre de l'objectif : la déclinaison est conservée en lecture seule.");
  if (s === "non_applicable") return fail("Une dérogation validée rend l'objectif non applicable : le groupe doit la révoquer pour le reprendre.");
  if (derogationStatut === "demandee") return fail("Une demande de dérogation est en cours : attendez la décision du groupe ou retirez-la.");
  const allowed: Record<StateAction, [DeclinaisonEtat, DeclinaisonEtat]> = {
    prendre_en_charge: ["non_pris_en_charge", "pris_en_charge"],
    annuler_prise_en_charge: ["pris_en_charge", "non_pris_en_charge"],
    demarrer: ["pris_en_charge", "en_cours"],
    terminer: ["en_cours", "termine"],
    rouvrir: ["termine", "en_cours"],
  };
  const t = allowed[action];
  if (!t) return fail("Action inconnue.");
  if (s !== t[0]) return fail(`Action impossible depuis l'état « ${ETAT_LABELS[s]} ».`);
  return { ok: true, value: t[1] };
}

export type DerogationAction = "demander" | "retirer" | "valider" | "refuser" | "revoquer";
export interface DerogationState {
  etat: DeclinaisonEtat;
  statut: "demandee" | "validee" | "refusee" | null;
}

// Dérogation : l'établissement demande ; le groupe valide ou refuse (motif de la demande et note de décision conservés).
export function applyDerogation(cur: { etat: string | null; statut: string | null }, action: DerogationAction, input: { motif?: string; note?: string } = {}): Outcome<DerogationState> {
  const etat: DeclinaisonEtat = isEtat(cur.etat) ? cur.etat : "non_pris_en_charge";
  const statut = (cur.statut as DerogationState["statut"]) ?? null;
  if (etat === "hors_perimetre") return fail("L'établissement est hors périmètre.");
  switch (action) {
    case "demander":
      if (!input.motif || !input.motif.trim()) return fail("Le motif de la dérogation est obligatoire.");
      if (statut === "demandee") return fail("Une demande est déjà en cours.");
      if (statut === "validee" || etat === "non_applicable") return fail("Une dérogation est déjà validée.");
      if (etat === "en_cours" || etat === "termine") return fail("Une dérogation ne peut pas être demandée une fois la mise en œuvre commencée.");
      return { ok: true, value: { etat, statut: "demandee" } };
    case "retirer":
      if (statut !== "demandee") return fail("Aucune demande en cours à retirer.");
      return { ok: true, value: { etat, statut: null } };
    case "valider":
      if (statut !== "demandee") return fail("Aucune demande à valider.");
      return { ok: true, value: { etat: "non_applicable", statut: "validee" } };
    case "refuser":
      if (statut !== "demandee") return fail("Aucune demande à refuser.");
      if (!input.note || !input.note.trim()) return fail("Le refus doit être motivé.");
      return { ok: true, value: { etat, statut: "refusee" } };
    case "revoquer":
      if (statut !== "validee") return fail("Aucune dérogation validée à révoquer.");
      return { ok: true, value: { etat: "non_pris_en_charge", statut: null } };
  }
  return fail("Action inconnue.");
}

// Seuls le directeur ou l'administrateur du groupe (ou un administrateur plateforme) valident ou refusent une dérogation.
export function canDecideDerogation(assignments: { role: string; scopeType: string; scopeId: string }[], groupId: string): boolean {
  return assignments.some(
    (a) => (a.scopeType === "plateforme" && a.role === "administrateur") || (a.scopeType === "groupe" && a.scopeId === groupId && (a.role === "directeur" || a.role === "administrateur"))
  );
}

// État de départ d'une déclinaison existante : « en cours » si elle a déjà une action, une mesure ou un responsable.
export function suggestInitialState(s: { actions: number; measures: number; baselines: number; hasResponsable: boolean }): "en_cours" | "non_pris_en_charge" {
  return s.actions > 0 || s.measures > 0 || s.baselines > 0 || s.hasResponsable ? "en_cours" : "non_pris_en_charge";
}

// --- Diffusion sélective --------------------------------------------------------------------------------------------

export interface SelectionPlan {
  targets: string[];
  toCreate: string[]; // destinataires sans déclinaison
  toRestore: string[]; // revenus dans le périmètre : déclinaison « hors périmètre » restaurée
  toRemove: string[]; // sortis du périmètre : déclinaison conservée, marquée « hors périmètre » (jamais supprimée)
}

export function planSelection(input: {
  mode: "tous" | "selection";
  selectedIds: string[];
  allEstablishmentIds: string[];
  existingChildren: { establishmentId: string; miseEnOeuvre: string | null }[];
}): SelectionPlan {
  const all = new Set(input.allEstablishmentIds);
  const targets = input.mode === "tous" ? Array.from(all) : Array.from(new Set(input.selectedIds.filter((id) => all.has(id))));
  const t = new Set(targets);
  const existing = new Map(input.existingChildren.map((c) => [c.establishmentId, c.miseEnOeuvre]));
  return {
    targets,
    toCreate: targets.filter((id) => !existing.has(id)),
    toRestore: targets.filter((id) => existing.get(id) === "hors_perimetre"),
    toRemove: Array.from(existing.keys()).filter((id) => !t.has(id) && existing.get(id) !== "hors_perimetre"),
  };
}

export function validateSelectionInput(mode: unknown, selectedIds: unknown, allEstablishmentIds: string[]): string | null {
  if (mode !== "tous" && mode !== "selection") return "Mode de diffusion invalide.";
  if (mode === "selection") {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return "Sélectionnez au moins un établissement.";
    const all = new Set(allEstablishmentIds);
    if (selectedIds.some((id) => typeof id !== "string" || !all.has(id))) return "Établissement hors du groupe.";
  }
  return null;
}

// --- Changements du groupe à examiner -------------------------------------------------------------------------------

// Champs suivis d'un objectif de groupe. `auto` : déjà propagé automatiquement (verrouillé côté établissement) — le signalement
// est informatif. Les autres champs sont locaux à la déclinaison : ils ne sont recopiés qu'à l'acceptation. La cible locale,
// les indicateurs locaux, le responsable et le statut ne sont JAMAIS concernés.
export const TRACKED_FIELDS: { key: string; auto: boolean; label: string }[] = [
  { key: "libelle", auto: true, label: "Intitulé" },
  { key: "description", auto: true, label: "Description" },
  { key: "resultatAttendu", auto: false, label: "Résultat attendu" },
  { key: "axe", auto: false, label: "Axe stratégique" },
  { key: "echeance", auto: false, label: "Échéance" },
  { key: "perimetre", auto: false, label: "Précision du périmètre" },
  { key: "perimetreOrg", auto: false, label: "Périmètre organisationnel" },
  { key: "populations", auto: false, label: "Population concernée" },
];

export interface FieldChange {
  from: string | null;
  to: string | null;
  auto: boolean;
}

const norm = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.length ? [...v].map(String).sort().join(", ") : null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

export function diffSourceFields(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const f of TRACKED_FIELDS) {
    if (!(f.key in after)) continue;
    const a = norm(before[f.key]);
    const b = norm(after[f.key]);
    if (a !== b) out[f.key] = { from: a, to: b, auto: f.auto };
  }
  return out;
}

// Changements encore à examiner par une déclinaison : postérieurs à sa création et sans décision.
export function pendingChanges<T extends { id: string; createdAt: Date }>(changes: T[], reviewedChangeIds: string[], childCreatedAt: Date): T[] {
  const done = new Set(reviewedChangeIds);
  return changes.filter((c) => !done.has(c.id) && c.createdAt.getTime() > childCreatedAt.getTime());
}

// Champs recopiés dans la déclinaison à l'acceptation : uniquement ceux qui ne sont pas déjà propagés automatiquement.
export function fieldsToApply(changes: Record<string, FieldChange>): string[] {
  return Object.entries(changes).filter(([, c]) => !c.auto).map(([k]) => k);
}

// Établissements destinataires d'un cycle de groupe diffusé. « aucune » (anciennes diffusions) vaut « tous » : la
// synchronisation historique diffusait à tout le monde. « selection » = uniquement la liste enregistrée (et existante).
export function allowedEstablishments(diffusion: string | null, targetIds: string[], allEstablishmentIds: string[]): string[] {
  if (diffusion === "selection") {
    const all = new Set(allEstablishmentIds);
    return Array.from(new Set(targetIds.filter((id) => all.has(id))));
  }
  return allEstablishmentIds.slice();
}
