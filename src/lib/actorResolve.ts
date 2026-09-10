import { prisma } from "@/lib/db";

export async function resolveActorName(actorId: string | null | undefined): Promise<string | null> {
  if (!actorId) return null;
  const actor = await prisma.actor.findUnique({ where: { id: actorId } });
  return actor?.name || null;
}
