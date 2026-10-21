import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ObjectiveNew } from "@/components/objectif/ObjectiveNew";
import { requirePageAccess } from "@/lib/pageAccess";

export const dynamic = "force-dynamic";

export default async function NewEstablishmentObjectivePage({ params }: { params: { id: string } }) {
  await requirePageAccess("establishment", params.id);
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!establishment) notFound();
  return <ObjectiveNew ownerType="etablissement" ownerId={establishment.id} basePath={`/establishments/${establishment.id}/objectifs`} backHref={`/establishments/${establishment.id}/objectifs`} />;
}
