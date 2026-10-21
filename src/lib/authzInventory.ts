// Inventaire des comptes avant activation du blocage (AUTHZ_MODE=enforce) — logique PURE, testée.
// Objectif : repérer les comptes qui perdraient tout accès, les affectations incohérentes, et préparer la régularisation
// des comptes légitimes sans jamais maintenir une autorisation générale par défaut. Lecture seule : aucune donnée modifiée.
import { ROLE_ALLOWED_SCOPES, type Role, type ScopeType } from "./roles";

export interface InvUser {
  id: string;
  email: string;
  name: string;
  status: string; // invited | active | suspended
  lastLoginAt: Date | null;
  actorId: string | null;
  assignments: { id: string; role: string; scopeType: string; scopeId: string }[];
  affiliations: { groupId: string | null; establishmentId: string | null }[]; // de l'acteur lié au compte
}

export type InvFlag =
  | "AUCUNE_AFFECTATION" | "SUSPENDU_AVEC_AFFECTATIONS" | "AFFECTATION_PORTEE_INEXISTANTE" | "ROLE_PORTEE_INCOHERENT"
  | "ADMIN_PLATEFORME" | "INVITATION_EN_ATTENTE" | "AFFECTATION_EN_DOUBLE";

export interface InvRow {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: string | null;
  assignments: { role: string; scopeType: string; scopeId: string; scopeLabel: string }[];
  flags: InvFlag[];
  // Piste de régularisation (à valider par un humain) : portées déduites des affiliations de l'acteur lié, jamais appliquées.
  suggestedScopes: { scopeType: ScopeType; scopeId: string; scopeLabel: string }[];
  willLoseAccessOnEnforce: boolean;
}

export function buildInventory(
  users: InvUser[],
  groups: { id: string; name: string }[],
  establishments: { id: string; name: string }[],
  initiatives: { id: string; name: string }[]
) {
  const label = (type: string, id: string): string | null => {
    if (type === "plateforme") return "Plateforme";
    const list = type === "groupe" ? groups : type === "etablissement" ? establishments : type === "initiative" ? initiatives : [];
    return list.find((x) => x.id === id)?.name ?? null;
  };
  const rows: InvRow[] = users.map((u) => {
    const flags: InvFlag[] = [];
    const seen = new Set<string>();
    const assignments = u.assignments.map((a) => {
      const l = label(a.scopeType, a.scopeId);
      if (l === null) flags.push("AFFECTATION_PORTEE_INEXISTANTE");
      const allowed = ROLE_ALLOWED_SCOPES[a.role as Role];
      if (!allowed || !allowed.includes(a.scopeType as ScopeType)) flags.push("ROLE_PORTEE_INCOHERENT");
      const key = `${a.role}|${a.scopeType}|${a.scopeId}`;
      if (seen.has(key)) flags.push("AFFECTATION_EN_DOUBLE");
      seen.add(key);
      if (a.role === "administrateur" && a.scopeType === "plateforme") flags.push("ADMIN_PLATEFORME");
      return { role: a.role, scopeType: a.scopeType, scopeId: a.scopeId, scopeLabel: l ?? "(introuvable)" };
    });
    if (u.assignments.length === 0) flags.push("AUCUNE_AFFECTATION");
    if (u.status === "suspended" && u.assignments.length > 0) flags.push("SUSPENDU_AVEC_AFFECTATIONS");
    if (u.status === "invited") flags.push("INVITATION_EN_ATTENTE");
    const suggested: InvRow["suggestedScopes"] = [];
    if (u.assignments.length === 0) {
      for (const af of u.affiliations) {
        if (af.establishmentId && label("etablissement", af.establishmentId)) suggested.push({ scopeType: "etablissement", scopeId: af.establishmentId, scopeLabel: label("etablissement", af.establishmentId)! });
        else if (af.groupId && label("groupe", af.groupId)) suggested.push({ scopeType: "groupe", scopeId: af.groupId, scopeLabel: label("groupe", af.groupId)! });
      }
    }
    // Un compte actif sans AUCUNE affectation valide perdrait tout accès métier en mode enforce.
    const validAssignments = u.assignments.filter((a) => label(a.scopeType, a.scopeId) !== null && ROLE_ALLOWED_SCOPES[a.role as Role]?.includes(a.scopeType as ScopeType));
    return {
      id: u.id, email: u.email, name: u.name, status: u.status, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      assignments, flags: Array.from(new Set(flags)), suggestedScopes: suggested,
      willLoseAccessOnEnforce: u.status === "active" && validAssignments.length === 0,
    };
  });
  const summary = {
    comptes: rows.length,
    actifs: rows.filter((r) => r.status === "active").length,
    perdentLAccesEnEnforce: rows.filter((r) => r.willLoseAccessOnEnforce).length,
    administrateursPlateforme: rows.filter((r) => r.flags.includes("ADMIN_PLATEFORME")).length,
    incoherences: rows.filter((r) => r.flags.some((f) => f === "AFFECTATION_PORTEE_INEXISTANTE" || f === "ROLE_PORTEE_INCOHERENT")).length,
  };
  const blockers: string[] = [];
  if (summary.administrateursPlateforme === 0) blockers.push("Aucun administrateur plateforme : personne ne pourrait gérer les comptes une fois le blocage activé.");
  if (summary.perdentLAccesEnEnforce > 0) blockers.push(`${summary.perdentLAccesEnEnforce} compte(s) actif(s) perdraient tout accès : régulariser ou suspendre avant d'activer le blocage.`);
  if (summary.incoherences > 0) blockers.push(`${summary.incoherences} compte(s) avec une affectation incohérente ou orpheline.`);
  return { summary, readyForEnforce: blockers.length === 0, blockers, rows };
}
