import { prisma } from "@/lib/db";
import { getScope, groupFilter, establishmentFilter } from "@/lib/scope";
import { NewInitiativeForm } from "@/components/NewInitiativeForm";

export const dynamic = "force-dynamic";

export default async function NewInitiativePage() {
  const scope = await getScope();
  const [groups, establishments] = await Promise.all([
    prisma.group.findMany({ where: groupFilter(scope), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.establishment.findMany({ where: establishmentFilter(scope), orderBy: { name: "asc" }, select: { id: true, name: true, groupId: true } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Nouvelle initiative</h1>
      <NewInitiativeForm groups={groups} establishments={establishments} />
    </div>
  );
}
