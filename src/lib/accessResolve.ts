import type { PermissionAction } from "./roles";
import { decide, type Assignment, type Decision, type ResourceScope } from "./authzCore";

// Résolution des portées et décision — SANS dépendance Next/Prisma (le client de base est injecté), donc testable unitairement.
// Voir access.ts pour les gardes de routes et les filtres de lecture.
export type AuthzMode = "audit" | "enforce";
export const authzMode = (): AuthzMode => (process.env.AUTHZ_MODE === "enforce" ? "enforce" : "audit");

type Db = any; // client Prisma (ou double de test)

export interface AccessUser {
  id: string;
  email: string;
  name: string;
  actorId: string | null;
}

export interface Access {
  user: AccessUser;
  assignments: Assignment[];
  mode: AuthzMode;
  db: Db;
  // Trace d'une opération sensible (administrateur plateforme) : fournie par access.ts, absente dans les tests.
  onSensitive?: (entry: { action: PermissionAction; what: string }) => Promise<void>;
}

// --- Résolution des portées -------------------------------------------------------------------------------------------

const INITIATIVE_CHILDREN = [
  "incident", "problem", "release", "stageCriterion", "meeting", "interface", "vigilancePoint", "anomaly", "trainingRecord",
  "trainingSession", "timelineEvent", "backlogItem", "budgetLine", "deliverable", "stakeholder", "kpi", "changeRequest",
  "requirement", "gap", "raciEntry", "actorAllocation", "initiativeEstablishment", "initiativeRequirementCoverage",
  "initiativeGoalContribution", "planningBaseline", "initiativeStage", "stageGateDecision",
] as const;
const OWNER_BOUND = ["action", "risk", "decision", "documentRef", "auditFinding", "strategicPlan", "strategicGoal", "qualityRequirement"] as const;
const ESTABLISHMENT_BOUND = ["installedProduct", "establishmentInterface", "requirementApplicability"] as const;

export type RecordModel =
  | (typeof INITIATIVE_CHILDREN)[number] | (typeof OWNER_BOUND)[number] | (typeof ESTABLISHMENT_BOUND)[number]
  | "initiative" | "establishment" | "group" | "strategicGoalCycle" | "goalIndicator" | "goalIndicatorMeasure"
  | "goalIndicatorBaseline" | "strategicGoalLink" | "initiativeRelation" | "baselineAudit" | "actor" | "actorAffiliation" | "actorUnavailability";

export async function initiativeScope(db: Db, id: string): Promise<ResourceScope | null> {
  const i = await db.initiative.findUnique({ where: { id }, select: { id: true, groupId: true, establishments: { select: { establishmentId: true } } } });
  if (!i) return null;
  return { groupId: i.groupId, level: "initiative", initiativeId: i.id, initiativeEstablishmentIds: i.establishments.map((e: any) => e.establishmentId) };
}

export async function establishmentScope(db: Db, id: string): Promise<ResourceScope | null> {
  const e = await db.establishment.findUnique({ where: { id }, select: { id: true, groupId: true } });
  return e ? { groupId: e.groupId, level: "etablissement", establishmentId: e.id } : null;
}

export async function groupScope(db: Db, id: string, sharedRead: string[] = []): Promise<ResourceScope | null> {
  const g = await db.group.findUnique({ where: { id }, select: { id: true } });
  return g ? { groupId: g.id, level: "groupe", sharedReadEstablishmentIds: sharedRead } : null;
}

export async function ownerScope(db: Db, ownerType: string | null | undefined, ownerId: string | null | undefined, sharedRead: string[] = []): Promise<ResourceScope | null> {
  if (!ownerType || !ownerId) return null;
  if (ownerType === "groupe") return groupScope(db, ownerId, sharedRead);
  if (ownerType === "etablissement") return establishmentScope(db, ownerId);
  if (ownerType === "initiative") return initiativeScope(db, ownerId);
  return null;
}

// Établissements autorisés à LIRE une donnée de groupe (jamais à la modifier) : ceux qui en portent une déclinaison.
async function childEstablishments(db: Db, kind: "plan" | "goal" | "cycle", id: string): Promise<string[]> {
  if (kind === "plan") return (await db.strategicPlan.findMany({ where: { parentPlanId: id }, select: { ownerId: true } })).map((r: any) => r.ownerId);
  if (kind === "goal") return (await db.strategicGoal.findMany({ where: { parentGoalId: id }, select: { ownerId: true } })).map((r: any) => r.ownerId);
  const kids = await db.strategicGoalCycle.findMany({ where: { parentCycleId: id }, select: { strategicGoal: { select: { ownerId: true } } } });
  return kids.map((r: any) => r.strategicGoal.ownerId);
}

export async function cycleScope(db: Db, cycleId: string): Promise<ResourceScope | null> {
  const c = await db.strategicGoalCycle.findUnique({ where: { id: cycleId }, select: { strategicGoal: { select: { ownerType: true, ownerId: true } } } });
  if (!c) return null;
  const shared = c.strategicGoal.ownerType === "groupe" ? await childEstablishments(db, "cycle", cycleId) : [];
  return ownerScope(db, c.strategicGoal.ownerType, c.strategicGoal.ownerId, shared);
}

export async function recordScope(db: Db, model: RecordModel, id: string): Promise<ResourceScope | null> {
  if (!id) return null;
  if (model === "initiative") return initiativeScope(db, id);
  if (model === "establishment") return establishmentScope(db, id);
  if (model === "group") return groupScope(db, id);
  if (model === "strategicGoalCycle") return cycleScope(db, id);

  if ((INITIATIVE_CHILDREN as readonly string[]).includes(model)) {
    const r = await db[model].findUnique({ where: { id }, select: { initiativeId: true } });
    return r?.initiativeId ? initiativeScope(db, r.initiativeId) : null;
  }
  if ((ESTABLISHMENT_BOUND as readonly string[]).includes(model)) {
    const r = await db[model].findUnique({ where: { id }, select: { establishmentId: true } });
    return r?.establishmentId ? establishmentScope(db, r.establishmentId) : null;
  }
  if ((OWNER_BOUND as readonly string[]).includes(model)) {
    const r = await db[model].findUnique({ where: { id } });
    if (!r) return null;
    let shared: string[] = [];
    if (r.ownerType === "groupe") {
      if (model === "strategicPlan") shared = await childEstablishments(db, "plan", id);
      else if (model === "strategicGoal") shared = await childEstablishments(db, "goal", id);
      else if (model === "qualityRequirement") shared = (await db.establishment.findMany({ where: { groupId: r.ownerId }, select: { id: true } })).map((e: any) => e.id);
    }
    const byOwner = await ownerScope(db, r.ownerType, r.ownerId, shared);
    if (byOwner) return byOwner;
    return r.initiativeId ? initiativeScope(db, r.initiativeId) : null; // anciennes lignes sans propriétaire
  }
  if (model === "goalIndicator") {
    const r = await db.goalIndicator.findUnique({ where: { id }, select: { strategicGoalCycleId: true } });
    return r ? cycleScope(db, r.strategicGoalCycleId) : null;
  }
  if (model === "goalIndicatorMeasure" || model === "goalIndicatorBaseline") {
    const r = await db[model].findUnique({ where: { id }, select: { goalIndicatorId: true } });
    return r ? recordScope(db, "goalIndicator", r.goalIndicatorId) : null;
  }
  if (model === "initiativeRelation") {
    const r = await db.initiativeRelation.findUnique({ where: { id }, select: { initiativeSourceId: true } });
    return r ? initiativeScope(db, r.initiativeSourceId) : null;
  }
  if (model === "strategicGoalLink") {
    const r = await db.strategicGoalLink.findUnique({ where: { id }, select: { strategicGoalCycleId: true } });
    return r ? cycleScope(db, r.strategicGoalCycleId) : null;
  }
  if (model === "baselineAudit") {
    const r = await db.baselineAudit.findUnique({ where: { id }, select: { actionId: true, establishmentId: true } });
    if (!r) return null;
    return r.establishmentId ? establishmentScope(db, r.establishmentId) : recordScope(db, "action", r.actionId);
  }
  if (model === "actor" || model === "actorAffiliation" || model === "actorUnavailability") {
    const actorId = model === "actor" ? id : (await db[model].findUnique({ where: { id }, select: { actorId: true } }))?.actorId;
    if (!actorId) return null;
    return actorScope(db, actorId);
  }
  return null;
}

// Un acteur (annuaire) est rattaché à un groupe par ses affiliations ; lisible par les établissements affiliés, modifiable
// par le groupe. Un acteur sans affiliation n'est rattachable à aucun périmètre (réservé plateforme).
export async function actorScope(db: Db, actorId: string): Promise<ResourceScope | null> {
  const actor = await db.actor.findUnique({ where: { id: actorId }, select: { initiativeId: true } });
  if (!actor) return null;
  if (actor.initiativeId) return initiativeScope(db, actor.initiativeId); // membre d'un projet
  const affs = await db.actorAffiliation.findMany({ where: { actorId }, select: { groupId: true, establishmentId: true } });
  const withGroup = affs.find((a: any) => a.groupId);
  const estIds = affs.map((a: any) => a.establishmentId).filter(Boolean);
  let groupId: string | null = withGroup?.groupId ?? null;
  if (!groupId && estIds.length > 0) groupId = (await db.establishment.findUnique({ where: { id: estIds[0] }, select: { groupId: true } }))?.groupId ?? null;
  return groupId ? { groupId, level: "groupe", sharedReadEstablishmentIds: estIds } : null;
}

// Une référence à contrôler : la portée et, si elle diffère de l'action principale, l'action requise sur elle.
export interface ScopeRef {
  scope: ResourceScope | null;
  action?: PermissionAction;
}

// Références portées par un corps de requête (création / modification). TOUTES doivent être autorisées : un identifiant fourni par
// le navigateur ne suffit jamais. Une référence introuvable donne `scope: null` (refusée hors rôle plateforme).
// Un établissement cité à côté d'une autre cible (projet, propriétaire, objectif…) n'est qu'un LIEN : « voir » suffit ;
// cité seul, c'est la cible de l'écriture.
export async function bodyScopes(db: Db, body: any, hasPrimary = false): Promise<ScopeRef[]> {
  const out: ScopeRef[] = [];
  if (!body || typeof body !== "object") return out;
  const add = async (p: Promise<ResourceScope | null>) => out.push({ scope: await p });
  if (body.initiativeId) await add(initiativeScope(db, String(body.initiativeId)));
  if (body.ownerType && body.ownerId) await add(ownerScope(db, String(body.ownerType), String(body.ownerId)));
  if (body.strategicGoalCycleId) await add(cycleScope(db, String(body.strategicGoalCycleId)));
  if (body.strategicGoalId) await add(recordScope(db, "strategicGoal", String(body.strategicGoalId)));
  if (body.strategicPlanId) await add(recordScope(db, "strategicPlan", String(body.strategicPlanId)));
  if (body.indicatorId) await add(recordScope(db, "goalIndicator", String(body.indicatorId)));
  if (body.goalIndicatorId) await add(recordScope(db, "goalIndicator", String(body.goalIndicatorId)));
  if (body.qualityRequirementId) await add(recordScope(db, "qualityRequirement", String(body.qualityRequirementId)));
  if (body.auditFindingId) await add(recordScope(db, "auditFinding", String(body.auditFindingId)));
  if (body.actorId) await add(actorScope(db, String(body.actorId)));
  if (body.ownerId && !body.ownerType) await add(ownerScope(db, "initiative", String(body.ownerId))); // documents : propriétaire « initiative » par défaut
  if (body.groupId && !body.ownerType) await add(groupScope(db, String(body.groupId)));
  if (body.affiliation && typeof body.affiliation === "object") out.push(...(await bodyScopes(db, body.affiliation, out.length > 0)));
  const primary = hasPrimary || out.length > 0;
  const link: PermissionAction | undefined = primary ? "voir" : undefined;
  if (body.establishmentId) out.push({ scope: await establishmentScope(db, String(body.establishmentId)), action: link });
  for (const k of ["establishmentIds", "scopeEstablishmentIds"]) {
    if (Array.isArray(body[k])) for (const id of body[k]) out.push({ scope: await establishmentScope(db, String(id)), action: "voir" });
  }
  return out;
}

const logDecision = (access: Access, kind: string, action: PermissionAction, what: string, d: Decision) =>
  console.warn(JSON.stringify({ authz: kind, mode: access.mode, userId: access.user.id, action, resource: what, reason: d.reason, assignments: access.assignments.length }));

export async function authorizeScopes(access: Access, action: PermissionAction, scopes: (ResourceScope | null | ScopeRef)[], what: string): Promise<{ allowed: boolean; decisions: Decision[] }> {
  const decisions = scopes.map((s) => {
    const ref: ScopeRef = s !== null && typeof s === "object" && "scope" in s ? (s as ScopeRef) : { scope: s as ResourceScope | null };
    return decide(access.assignments, ref.action ?? action, ref.scope);
  });
  const denied = decisions.find((d) => !d.allowed);
  if (denied) {
    logDecision(access, access.mode === "enforce" ? "deny" : "audit-would-deny", action, what, denied);
    if (access.mode === "enforce") return { allowed: false, decisions };
  }
  // Opérations sensibles d'un administrateur plateforme : tracées (qui, quoi, où).
  const sensitive = decisions.find((d) => d.allowed && d.sensitive);
  if (sensitive && action !== "creer" && access.onSensitive) {
    try {
      await access.onSensitive({ action, what });
    } catch { /* la trace ne doit pas bloquer l'opération */ }
  }
  return { allowed: true, decisions };
}

