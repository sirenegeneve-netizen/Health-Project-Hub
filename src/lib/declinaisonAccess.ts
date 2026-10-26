import { prisma } from "@/lib/db";
import { loadAccess, cycleScope } from "@/lib/access";
import { decide } from "@/lib/authzCore";
import { canDecideDerogation } from "@/lib/declinaison";

// Droits de l'utilisateur courant sur un objectif, pour AFFICHER ou masquer les boutons. Le contrôle réel reste celui des routes
// (serveur) : ceci n'est qu'une aide d'affichage, jamais une protection.
export interface DeclinationRights {
  canModify: boolean; // modifier la déclinaison (établissement)
  canDiffuse: boolean; // diffuser l'objectif de groupe
  canDecide: boolean; // décider d'une dérogation (directeur / administrateur du groupe)
}

export async function declinationRights(cycleId: string, groupId: string | null): Promise<DeclinationRights> {
  const none = { canModify: false, canDiffuse: false, canDecide: false };
  const access = await loadAccess();
  if (!access) return none;
  const scope = await cycleScope(prisma, cycleId);
  if (!scope) return none;
  const a = access.assignments;
  return {
    canModify: decide(a, "modifier", scope).allowed,
    canDiffuse: decide(a, "diffuser", scope).allowed,
    canDecide: !!groupId && decide(a, "valider", scope).allowed && canDecideDerogation(a, groupId),
  };
}
