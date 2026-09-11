import { prisma } from "@/lib/db";

// Acteurs visibles pour une Initiative donnée (architecture Groupe > Établissement
// > Initiative, §5 du document de conception) : ceux créés directement sous cette
// initiative, PLUS ceux rattachés (ActorAffiliation) au Groupe de l'initiative ou à
// l'un des établissements qu'elle concerne. Permet de réutiliser un même acteur
// (ex. référent informatique d'un établissement) sur plusieurs initiatives de ce
// même établissement au lieu de le recréer à chaque fois.
export async function findInitiativeActors<T extends { id: true; name: true } | undefined = undefined>(
  initiativeId: string,
  select?: T
) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { groupId: true, establishments: { select: { establishmentId: true } } },
  });
  if (!initiative) return [];

  const establishmentIds = initiative.establishments.map((e) => e.establishmentId);

  return prisma.actor.findMany({
    where: {
      OR: [
        { initiativeId },
        {
          affiliations: {
            some: {
              OR: [
                { groupId: initiative.groupId },
                ...(establishmentIds.length ? [{ establishmentId: { in: establishmentIds } }] : []),
              ],
            },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
    ...(select ? { select } : {}),
  } as any);
}
