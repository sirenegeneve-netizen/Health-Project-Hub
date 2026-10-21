// Cœur PUR de l'autorisation (aucune dépendance base / Next) : décide, à partir des affectations de l'utilisateur et de la
// portée d'une ressource, si une action est permise. Testé unitairement (accès croisés entre établissements).
// Principe : moindre privilège. Une affectation de groupe donne la CONSULTATION des données locales de son groupe, pas leur
// modification. Aucun accès implicite : sans affectation valide, rien n'est permis.

import { PERMISSIONS, type PermissionAction, type Role, type ScopeType } from "./roles";

export interface Assignment {
  role: Role;
  scopeType: ScopeType;
  scopeId: string;
}

// Niveau auquel vit la ressource :
//  - groupe : donnée du groupe (plan, objectif, risque, action… dont le propriétaire est le groupe) ;
//  - etablissement : donnée propre à un établissement ;
//  - initiative : donnée d'un projet (initiative). `initiativeEstablishmentIds` = établissements rattachés au projet.
export interface ResourceScope {
  groupId: string;
  level: "groupe" | "etablissement" | "initiative";
  establishmentId?: string;
  initiativeId?: string;
  initiativeEstablishmentIds?: string[];
  // Donnée de groupe lisible par ces établissements (ex. objectif source d'une déclinaison) — jamais en écriture.
  sharedReadEstablishmentIds?: string[];
}

export interface Decision {
  allowed: boolean;
  reason: string;
  via?: Assignment;
  // Vrai quand l'autorisation repose sur un rôle plateforme pour une écriture : opération sensible à tracer.
  sensitive?: boolean;
}

const WRITE: PermissionAction[] = ["creer", "modifier", "supprimer", "valider", "diffuser"];
export const isWrite = (a: PermissionAction): boolean => WRITE.includes(a);

function covers(a: Assignment, action: PermissionAction, scope: ResourceScope): { ok: boolean; reason: string } {
  if (a.scopeType === "plateforme") return { ok: true, reason: "plateforme" };

  if (a.scopeType === "groupe") {
    if (a.scopeId !== scope.groupId) return { ok: false, reason: "autre groupe" };
    if (scope.level === "groupe") return { ok: true, reason: "groupe" };
    if (action === "voir") return { ok: true, reason: "consultation par le groupe" };
    if (scope.level === "initiative") {
      // Projet géré au niveau du groupe (transversal ou partagé) : le groupe peut agir. Projet local à un seul
      // établissement : seul le chef de projet de groupe peut le modifier.
      const n = (scope.initiativeEstablishmentIds || []).length;
      if (n !== 1 || a.role === "chef_de_projet") return { ok: true, reason: "projet géré par le groupe" };
    }
    return { ok: false, reason: "modification locale non permise par un rôle de groupe" };
  }

  if (a.scopeType === "etablissement") {
    if (scope.level === "etablissement") return scope.establishmentId === a.scopeId ? { ok: true, reason: "établissement" } : { ok: false, reason: "autre établissement" };
    if (scope.level === "initiative") return (scope.initiativeEstablishmentIds || []).includes(a.scopeId) ? { ok: true, reason: "projet rattaché à l'établissement" } : { ok: false, reason: "projet d'un autre établissement" };
    if (scope.level === "groupe") return action === "voir" && (scope.sharedReadEstablishmentIds || []).includes(a.scopeId) ? { ok: true, reason: "donnée du groupe partagée avec l'établissement" } : { ok: false, reason: "donnée de groupe non partagée" };
  }

  if (a.scopeType === "initiative") {
    return scope.level === "initiative" && scope.initiativeId === a.scopeId ? { ok: true, reason: "projet" } : { ok: false, reason: "autre projet" };
  }
  return { ok: false, reason: "portée inconnue" };
}

export function decide(assignments: Assignment[], action: PermissionAction, scope: ResourceScope | null): Decision {
  if (assignments.length === 0) return { allowed: false, reason: "aucune affectation" };
  if (!scope) {
    // Ressource sans rattachement identifiable : réservée au rôle plateforme.
    const p = assignments.find((a) => a.scopeType === "plateforme" && PERMISSIONS[a.role][action]);
    return p ? { allowed: true, reason: "ressource sans rattachement (plateforme)", via: p, sensitive: isWrite(action) } : { allowed: false, reason: "ressource sans rattachement identifiable" };
  }
  let lastReason = "aucune affectation ne couvre la ressource";
  for (const a of assignments) {
    if (!PERMISSIONS[a.role]?.[action]) {
      lastReason = `le rôle ${a.role} n'a pas la permission « ${action} »`;
      continue;
    }
    const c = covers(a, action, scope);
    if (c.ok) return { allowed: true, reason: c.reason, via: a, sensitive: a.scopeType === "plateforme" && isWrite(action) };
    lastReason = c.reason;
  }
  return { allowed: false, reason: lastReason };
}

// Établissements dont l'utilisateur peut LIRE les données (pour filtrer toute consolidation, liste ou export).
export function visibleEstablishmentIds(assignments: Assignment[], all: { id: string; groupId: string }[]): string[] {
  if (assignments.some((a) => a.scopeType === "plateforme" && PERMISSIONS[a.role].voir)) return all.map((e) => e.id);
  const ids = new Set<string>();
  for (const a of assignments) {
    if (!PERMISSIONS[a.role].voir) continue;
    if (a.scopeType === "groupe") all.filter((e) => e.groupId === a.scopeId).forEach((e) => ids.add(e.id));
    if (a.scopeType === "etablissement") all.filter((e) => e.id === a.scopeId).forEach((e) => ids.add(e.id));
  }
  return Array.from(ids);
}

export function visibleGroupIds(assignments: Assignment[], allGroups: { id: string }[], establishments: { id: string; groupId: string }[]): string[] {
  if (assignments.some((a) => a.scopeType === "plateforme" && PERMISSIONS[a.role].voir)) return allGroups.map((g) => g.id);
  const ids = new Set<string>();
  for (const a of assignments) {
    if (!PERMISSIONS[a.role].voir) continue;
    if (a.scopeType === "groupe") ids.add(a.scopeId);
    if (a.scopeType === "etablissement") establishments.filter((e) => e.id === a.scopeId).forEach((e) => ids.add(e.groupId));
  }
  return Array.from(ids);
}

// Groupes dont l'utilisateur voit les données de GROUPE (pas seulement ses établissements).
export function groupLevelGroupIds(assignments: Assignment[], allGroups: { id: string }[]): string[] {
  if (assignments.some((a) => a.scopeType === "plateforme" && PERMISSIONS[a.role].voir)) return allGroups.map((g) => g.id);
  return Array.from(new Set(assignments.filter((a) => a.scopeType === "groupe" && PERMISSIONS[a.role].voir).map((a) => a.scopeId)));
}

export const isPlatformAdmin = (assignments: Assignment[]): boolean => assignments.some((a) => a.scopeType === "plateforme" && a.role === "administrateur");
