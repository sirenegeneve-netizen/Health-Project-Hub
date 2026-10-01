import { prisma } from "@/lib/db";
import { Role, ScopeType, PermissionAction, PERMISSIONS, GLOBAL_SCOPE_ID, ROLE_ALLOWED_SCOPES } from "@/lib/roles";

export { GLOBAL_SCOPE_ID, ROLE_ALLOWED_SCOPES };
export type { Role, ScopeType, PermissionAction };

export interface ResolvedAssignment {
  role: Role;
  scopeType: ScopeType;
  scopeId: string;
}

export async function getUserAssignments(userId: string): Promise<ResolvedAssignment[]> {
  const rows = await prisma.userAssignment.findMany({ where: { userId } });
  return rows.map((r) => ({ role: r.role as Role, scopeType: r.scopeType as ScopeType, scopeId: r.scopeId }));
}

// Calcule si une affectation couvre une cible donnée, en respectant la
// descendance Groupe → Établissement → Initiative (jamais l'inverse : une
// affectation Initiative ne remonte pas à son Établissement/Groupe).
async function assignmentCoversTarget(a: ResolvedAssignment, targetType: ScopeType, targetId: string): Promise<boolean> {
  if (a.scopeType === "plateforme") return true;
  if (a.scopeType === targetType && a.scopeId === targetId) return true;

  if (a.scopeType === "groupe") {
    if (targetType === "etablissement") {
      const etab = await prisma.establishment.findUnique({ where: { id: targetId }, select: { groupId: true } });
      return etab?.groupId === a.scopeId;
    }
    if (targetType === "initiative") {
      const initiative = await prisma.initiative.findUnique({ where: { id: targetId }, select: { groupId: true } });
      return initiative?.groupId === a.scopeId;
    }
  }
  if (a.scopeType === "etablissement" && targetType === "initiative") {
    const link = await prisma.initiativeEstablishment.findFirst({ where: { initiativeId: targetId, establishmentId: a.scopeId } });
    return !!link;
  }
  return false;
}

export interface AuthzUser {
  id: string;
  assignments: ResolvedAssignment[];
}

// Vérifie si l'utilisateur peut réaliser `action` sur une cible de portée
// (targetType, targetId). MODE TRANSITOIRE : un utilisateur sans aucune
// affectation garde un accès complet (comme avant l'introduction de ce
// module) — évite de verrouiller tout le monde dehors tant que les comptes
// existants n'ont pas été affectés manuellement. À retirer une fois toutes
// les affectations faites (voir chantier "gestion structurée des comptes").
export async function can(user: AuthzUser, action: PermissionAction, target: { type: ScopeType; id: string }): Promise<boolean> {
  if (user.assignments.length === 0) return true; // mode transitoire

  for (const a of user.assignments) {
    if (!PERMISSIONS[a.role][action]) continue;
    if (await assignmentCoversTarget(a, target.type, target.id)) return true;
  }
  return false;
}

// Raccourci pour les permissions de portée "plateforme" (gestion des
// utilisateurs globale, gestion de structure globale) — ex. qui peut ouvrir
// /admin/users sans restriction de périmètre.
export async function canGlobally(user: AuthzUser, action: PermissionAction): Promise<boolean> {
  return can(user, action, { type: "plateforme", id: GLOBAL_SCOPE_ID });
}

// Un administrateur/référent établissement ne peut affecter un rôle que dans
// une portée qu'il couvre lui-même (empêche une élévation de privilège par un
// administrateur de groupe vers un autre groupe, par ex.).
export async function canManageScope(user: AuthzUser, target: { type: ScopeType; id: string }): Promise<boolean> {
  return can(user, "gererUtilisateurs", target);
}
