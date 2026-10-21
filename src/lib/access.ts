import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS, type PermissionAction } from "@/lib/roles";
import { groupLevelGroupIds, visibleEstablishmentIds, visibleGroupIds, type Assignment, type ResourceScope } from "@/lib/authzCore";
import {
  authorizeScopes, type ScopeRef, authzMode, bodyScopes, cycleScope, establishmentScope, groupScope, initiativeScope, ownerScope, recordScope,
  type Access, type AuthzMode, type RecordModel,
} from "@/lib/accessResolve";

export * from "@/lib/accessResolve";

// Couche d'autorisation SERVEUR centralisée : gardes de routes et filtres de lecture. La logique de décision est dans
// accessResolve.ts / authzCore.ts (pures et testées). Mode : AUTHZ_MODE = "enforce" (refus réel) ou "audit" (journalise sans bloquer).
type Db = any;

export interface GuardResult {
  ok: boolean;
  user?: Access["user"];
  access?: Access;
  response?: NextResponse;
}

export async function loadAccess(db: Db = prisma): Promise<Access | null> {
  const { user } = await requireUser();
  if (!user) return null;
  const rows = await db.userAssignment.findMany({ where: { userId: user.id } });
  const assignments: Assignment[] = rows.map((r: any) => ({ role: r.role, scopeType: r.scopeType, scopeId: r.scopeId }));
  return {
    user,
    assignments,
    mode: authzMode(),
    db,
    onSensitive: async ({ action, what }) => {
      await logAudit({ entityType: "securite", entityId: what.slice(0, 60), entityLabel: `${action} ${what}`.slice(0, 120), action: "update", changes: { operation_sensible: { from: null, to: `${action} (rôle plateforme)` } }, user: { id: user.id, name: user.name } });
    },
  };
}

const unauthorized = () => NextResponse.json({ error: "Authentification requise." }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Accès refusé." }, { status: 403 });
const notFound = () => NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });

async function finish(access: Access, action: PermissionAction, scopes: (ResourceScope | null | ScopeRef)[], what: string): Promise<GuardResult> {
  if (scopes.length === 0) return { ok: false, response: forbidden() };
  const r = await authorizeScopes(access, action, scopes, what);
  return r.allowed ? { ok: true, user: access.user, access } : { ok: false, response: forbidden() };
}

// Ressource existante par identifiant (+ références éventuelles du corps pour une modification).
export async function guardRecord(model: RecordModel, id: string, action: PermissionAction, body?: any, db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  if (!access) return { ok: false, response: unauthorized() };
  const base = await recordScope(db, model, id);
  if (base === null) {
    // Ressource introuvable : 404. Existante mais sans rattachement identifiable : décision « sans rattachement » (plateforme seulement).
    const exists = await db[model].findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { ok: false, response: notFound() };
  }
  const refs = body ? await bodyScopes(db, body, true) : [];
  return finish(access, action, [base, ...refs], `${model}:${id}`);
}

// Création : toutes les références du corps doivent être autorisées ; au moins une est requise.
export async function guardCreate(model: string, body: any, action: PermissionAction = "creer", db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  if (!access) return { ok: false, response: unauthorized() };
  const refs = await bodyScopes(db, body);
  if (refs.length === 0) {
    // aucune référence de périmètre : seul un rôle plateforme peut créer
    return finish(access, action, [null], `${model}:sans-périmètre`);
  }
  return finish(access, action, refs, `${model}:création`);
}

// Portée explicite (groupe, établissement, projet, propriétaire).
export async function guardScope(scopeFn: (db: Db) => Promise<ResourceScope | null>, action: PermissionAction, what: string, db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  if (!access) return { ok: false, response: unauthorized() };
  const s = await scopeFn(db);
  if (s === null) return { ok: false, response: notFound() };
  return finish(access, action, [s], what);
}

export const guardGroup = (id: string, action: PermissionAction, db: Db = prisma) => guardScope((d) => groupScope(d, id), action, `group:${id}`, db);
export const guardEstablishment = (id: string, action: PermissionAction, db: Db = prisma) => guardScope((d) => establishmentScope(d, id), action, `establishment:${id}`, db);
export const guardInitiative = (id: string, action: PermissionAction, db: Db = prisma) => guardScope((d) => initiativeScope(d, id), action, `initiative:${id}`, db);
export const guardCycle = (id: string, action: PermissionAction, db: Db = prisma) => guardScope((d) => cycleScope(d, id), action, `cycle:${id}`, db);
export const guardOwner = (ownerType: string, ownerId: string, action: PermissionAction, db: Db = prisma) => guardScope((d) => ownerScope(d, ownerType, ownerId), action, `${ownerType}:${ownerId}`, db);

// Authentifié seulement, pour les routes qui filtrent elles-mêmes leurs résultats (liste, recherche, « mon espace »).
export async function guardAuthenticated(db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  return access ? { ok: true, user: access.user, access } : { ok: false, response: unauthorized() };
}

// --- Filtres de lecture (listes, consolidations, exports, recherche) ---------------------------------------------------

export interface Visibility {
  all: boolean; // rôle plateforme : aucun filtre
  establishmentIds: string[]; // établissements lisibles (groupe ou établissement)
  groupIds: string[]; // groupes lisibles (au moins un établissement ou le groupe)
  groupAssignIds: string[]; // groupes dont les données de groupe sont lisibles
  estAssignIds: string[]; // établissements affectés directement
  initiativeAssignIds: string[]; // projets affectés directement
  enforced: boolean; // false en mode « audit » : filtre non appliqué mais calculé (pour journaliser)
}

export async function loadVisibility(access: Access): Promise<Visibility> {
  const [groups, ests] = await Promise.all([
    access.db.group.findMany({ select: { id: true } }),
    access.db.establishment.findMany({ select: { id: true, groupId: true } }),
  ]);
  const a = access.assignments;
  const all = a.some((x) => x.scopeType === "plateforme" && PERMISSIONS[x.role].voir);
  return {
    all,
    establishmentIds: visibleEstablishmentIds(a, ests),
    groupIds: visibleGroupIds(a, groups, ests),
    groupAssignIds: groupLevelGroupIds(a, groups),
    estAssignIds: a.filter((x) => x.scopeType === "etablissement").map((x) => x.scopeId),
    initiativeAssignIds: a.filter((x) => x.scopeType === "initiative").map((x) => x.scopeId),
    enforced: access.mode === "enforce",
  };
}

// Fragments Prisma : projets visibles / enregistrements à propriétaire visibles. Mode « audit » : pas de filtre.
export function initiativeVisibleWhere(v: Visibility): Record<string, unknown> {
  if (v.all || !v.enforced) return {};
  return { OR: [{ groupId: { in: v.groupAssignIds } }, { establishments: { some: { establishmentId: { in: v.estAssignIds } } } }, { id: { in: v.initiativeAssignIds } }] };
}

export function ownerVisibleWhere(v: Visibility): Record<string, unknown> {
  if (v.all || !v.enforced) return {};
  return { OR: [{ ownerType: "groupe", ownerId: { in: v.groupAssignIds } }, { ownerType: "etablissement", ownerId: { in: v.establishmentIds } }, { initiative: initiativeVisibleWhere(v) }] };
}

export const establishmentVisibleWhere = (v: Visibility): Record<string, unknown> => (v.all || !v.enforced ? {} : { id: { in: v.establishmentIds } });
export const groupVisibleWhere = (v: Visibility): Record<string, unknown> => (v.all || !v.enforced ? {} : { id: { in: v.groupIds } });

// Création rattachée à une cible principale (ex. un projet) ET à des objets simplement RÉFÉRENCÉS (objectif, exigence…) :
// écriture sur la cible, simple lecture sur les objets liés — mais jamais sans droit de voir l'objet lié.
export async function guardLink(model: string, body: any, linkKeys: string[], action: PermissionAction = "creer", db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  if (!access) return { ok: false, response: unauthorized() };
  const primary: any = {};
  const links: any = {};
  for (const [k, v] of Object.entries(body || {})) (linkKeys.includes(k) ? links : primary)[k] = v;
  const refs = await bodyScopes(db, primary);
  if (refs.length === 0) return finish(access, action, [null], `${model}:sans-périmètre`);
  const linked = (await bodyScopes(db, links, true)).map((r) => ({ scope: r.scope, action: "voir" as PermissionAction }));
  return finish(access, action, [...refs, ...linked], `${model}:création`);
}

// Création d'un projet : droit de création sur le groupe/établissements du projet (portée « projet » synthétique) et droit de
// voir chaque établissement rattaché. Un groupe ou un établissement introuvable est laissé à la route (400/404).
export async function guardInitiativeCreate(body: any, db: Db = prisma): Promise<GuardResult> {
  const access = await loadAccess(db);
  if (!access) return { ok: false, response: unauthorized() };
  const groupId = body?.groupId ? String(body.groupId) : null;
  if (!groupId || !(await groupScope(db, groupId))) return { ok: true, user: access.user, access };
  const ids: string[] = Array.isArray(body.establishmentIds) ? body.establishmentIds.map((x: any) => String(x)) : [];
  const synthetic: ResourceScope = { groupId, level: "initiative", initiativeEstablishmentIds: ids };
  const links: ScopeRef[] = [];
  for (const id of ids) links.push({ scope: await establishmentScope(db, id), action: "voir" });
  return finish(access, "creer", [synthetic, ...links], `initiative:création(groupe ${groupId})`);
}

// Combine un filtre existant avec un filtre de visibilité (sans effet si celui-ci est vide).
export function andWhere(where: Record<string, unknown>, visible: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(visible).length === 0 ? where : { AND: [where, visible] };
}
export function initiativeRelWhere(v: Visibility): Record<string, unknown> {
  const w = initiativeVisibleWhere(v);
  return Object.keys(w).length === 0 ? {} : { initiative: w };
}
