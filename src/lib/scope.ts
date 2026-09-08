import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// Le "périmètre" (scope) est le contexte global sélectionné en haut de l'app :
// Vue Groupe (tout) ou Vue Établissement (un établissement donné). Il est stocké
// en cookie (pas en query string) pour rester valable sur toute page servie par
// un composant serveur sans avoir à le propager manuellement dans chaque lien.
//
// Volontairement simple pour la Phase 1 : un seul niveau de filtre (établissement).
// La "Vue Projet" existe déjà nativement via /projects/[id] ; la "Vue personnelle"
// existe déjà via /me. On ne les modélise pas ici pour ne pas dupliquer une logique
// de filtrage qui vit déjà ailleurs.

export const SCOPE_COOKIE = "hph_scope_establishment";

export interface Scope {
  establishmentId: string | null;
  establishmentName: string | null;
}

export async function getScope(): Promise<Scope> {
  const store = await cookies();
  const establishmentId = store.get(SCOPE_COOKIE)?.value || null;
  if (!establishmentId) return { establishmentId: null, establishmentName: null };

  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId } });
  if (!establishment) return { establishmentId: null, establishmentName: null };

  return { establishmentId: establishment.id, establishmentName: establishment.name };
}

// Fragment Prisma réutilisable : filtre les projets sur l'établissement du scope
// courant quand il est défini, sinon ne filtre rien (vue Groupe).
export function projectScopeWhere(scope: Scope) {
  if (!scope.establishmentId) return {};
  return { establishments: { some: { establishmentId: scope.establishmentId } } };
}
