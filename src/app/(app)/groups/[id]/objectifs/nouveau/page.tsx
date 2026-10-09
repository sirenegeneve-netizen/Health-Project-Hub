import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ObjectiveNew } from "@/components/objectif/ObjectiveNew";

export const dynamic = "force-dynamic";

export default async function NewGroupObjectivePage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!group) notFound();
  return <ObjectiveNew ownerType="groupe" ownerId={group.id} basePath={`/groups/${group.id}/objectifs`} backHref={`/groups/${group.id}/objectifs`} />;
}
