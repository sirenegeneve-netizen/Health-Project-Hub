// Diffusion des plans et objectifs stratégiques d'un groupe vers ses établissements (logique pure).
// Principe retenu : les établissements SUIVENT le groupe — libellé (et description / dates / statut du plan)
// verrouillés sur la copie ; cible, indicateurs et statut de l'objectif propres à chaque établissement.

export interface ChildLink {
  ownerId: string; // établissement
  parentId: string | null; // objet du groupe dont la copie est issue
}

// Copies manquantes : un couple (établissement, parent) à créer par établissement qui n'a pas encore sa copie.
export function missingChildren(parentIds: string[], establishmentIds: string[], existing: ChildLink[]): { establishmentId: string; parentId: string }[] {
  const have = new Set(existing.filter((e) => e.parentId).map((e) => `${e.ownerId}::${e.parentId}`));
  const out: { establishmentId: string; parentId: string }[] = [];
  for (const parentId of parentIds) {
    for (const establishmentId of establishmentIds) {
      if (!have.has(`${establishmentId}::${parentId}`)) out.push({ establishmentId, parentId });
    }
  }
  return out;
}

// Champs que l'établissement ne peut pas modifier sur une copie héritée du groupe.
export const LOCKED_GOAL_FIELDS = ["libelle", "description"] as const;
export const LOCKED_PLAN_FIELDS = ["libelle", "startDate", "endDate", "statut"] as const;

// Renvoie la liste des champs verrouillés que la requête tente de modifier (vide = autorisé).
export function lockedFieldsTouched(isInherited: boolean, body: Record<string, unknown>, locked: readonly string[]): string[] {
  if (!isInherited) return [];
  return locked.filter((f) => body[f] !== undefined);
}

// Un cycle (objectif × plan) du groupe est diffusé quand l'objectif ET le plan le sont.
export function cycleIsDiffused(goal: { diffuse: boolean }, plan: { diffuse: boolean }): boolean {
  return goal.diffuse && plan.diffuse;
}

// Avancement de la déclinaison dans les établissements : combien ont renseigné une cible.
export function diffusionProgress(children: { cible: string | null; indicateurs: string | null }[]): { total: number; withTarget: number; withIndicators: number } {
  const filled = (v: string | null) => !!v && v.trim().length > 0;
  return {
    total: children.length,
    withTarget: children.filter((c) => filled(c.cible)).length,
    withIndicators: children.filter((c) => filled(c.indicateurs)).length,
  };
}
