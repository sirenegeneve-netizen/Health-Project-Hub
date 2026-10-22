import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { loadAccess, loadVisibility, initiativeVisibleWhere, ownerVisibleWhere, establishmentVisibleWhere, groupVisibleWhere, andWhere, type Visibility } from "@/lib/access";

// Le "périmètre" (scope) est le contexte global sélectionné en haut de l'app :
// Vue Groupe (tout) ou Vue Établissement (un établissement donné). Il est stocké
// en cookie (pas en query string) pour rester valable sur toute page servie par
// un composant serveur sans avoir à le propager manuellement dans chaque lien.
//
// Volontairement simple pour la Phase 1 : un seul niveau de filtre (établissement).
// La "Vue Projet" existe déjà nativement via /initiatives/[id] ; la "Vue personnelle"
// existe déjà via /me. On ne les modélise pas ici pour ne pas dupliquer une logique
// de filtrage qui vit déjà ailleurs.

export const SCOPE_COOKIE = "hph_scope_establishment";

export interface Scope {
  establishmentId: string | null;
  establishmentName: string | null;
  // Visibilité RÉELLE de l'utilisateur (affectations). Le cookie ci-dessus n'est qu'un filtre d'affichage : il ne donne
  // jamais accès à un établissement hors de cette visibilité.
  visibility: Visibility | null;
}

export async function getScope(): Promise<Scope> {
  const store = await cookies();
  const cookieId = store.get(SCOPE_COOKIE)?.value || null;
  const access = await loadAccess();
  const visibility = access ? await loadVisibility(access) : null;
  // Un identifiant d'établissement venu du navigateur ne suffit jamais : il doit être dans le périmètre autorisé.
  const allowedCookie = cookieId && (!visibility || !visibility.enforced || visibility.all || visibility.establishmentIds.includes(cookieId)) ? cookieId : null;
  // Compte limité à un seul établissement (mode « enforce ») : le périmètre est cet établissement, sans choix possible.
  const onlyOne = visibility && visibility.enforced && !visibility.all && visibility.establishmentIds.length === 1 ? visibility.establishmentIds[0] : null;
  const effectiveId = allowedCookie ?? onlyOne;
  if (!effectiveId) return { establishmentId: null, establishmentName: null, visibility };

  const establishment = await prisma.establishment.findUnique({ where: { id: effectiveId } });
  if (!establishment) return { establishmentId: null, establishmentName: null, visibility };

  return { establishmentId: establishment.id, establishmentName: establishment.name, visibility };
}

// Fragment Prisma réutilisable : filtre les projets sur l'établissement du scope
// courant quand il est défini, sinon ne filtre rien (vue Groupe).
export function initiativeScopeWhere(scope: Scope): Record<string, unknown> {
  const base = scope.establishmentId ? { establishments: { some: { establishmentId: scope.establishmentId } } } : {};
  return andWhere(base, scope.visibility ? initiativeVisibleWhere(scope.visibility) : {});
}

// Filtre « projet » prêt à l'emploi pour les modèles rattachés à un projet (undefined = aucun filtre).
export function initiativeFilter(scope: Scope): Record<string, unknown> | undefined {
  const w = initiativeScopeWhere(scope);
  return Object.keys(w).length ? w : undefined;
}

// Filtre pour les modèles à propriétaire (actions, risques, décisions, documents) en vue non scopée : seulement ce que
// l'utilisateur peut voir (groupe / établissements / projets autorisés). undefined = aucun filtre.
export function ownerFilter(scope: Scope): Record<string, unknown> | undefined {
  const w = scope.visibility ? ownerVisibleWhere(scope.visibility) : {};
  return Object.keys(w).length ? w : undefined;
}

// Équivalent pour les risques (et modèles avec la même forme owner : Action) :
// inclut les risques des initiatives de l'établissement du scope, ET les
// risques propres à cet établissement (ownerType="etablissement"). Un risque
// propre à un Groupe n'apparaît que dans la vue Groupe non scopée (return {}
// ci-dessous ne filtre rien, donc groupe/établissement/initiative confondus).
export function riskScopeWhere(scope: Scope): Record<string, unknown> {
  const vis = scope.visibility ? ownerVisibleWhere(scope.visibility) : {};
  if (!scope.establishmentId) return vis;
  return andWhere(
    {
      OR: [
        { initiative: { establishments: { some: { establishmentId: scope.establishmentId } } } },
        { ownerType: "etablissement", ownerId: scope.establishmentId },
      ],
    },
    vis
  );
}

export function establishmentFilter(scope: Scope): Record<string, unknown> | undefined {
  const w = scope.visibility ? establishmentVisibleWhere(scope.visibility) : {};
  return Object.keys(w).length ? w : undefined;
}
export function groupFilter(scope: Scope): Record<string, unknown> | undefined {
  const w = scope.visibility ? groupVisibleWhere(scope.visibility) : {};
  return Object.keys(w).length ? w : undefined;
}
