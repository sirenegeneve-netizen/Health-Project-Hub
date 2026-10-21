import { ObjectiveSheet } from "@/components/objectif/ObjectiveSheet";
import { requirePageAccess } from "@/lib/pageAccess";

export const dynamic = "force-dynamic";

export default async function EstablishmentObjectivePage({ params }: { params: { id: string; cycleId: string } }) {
  await requirePageAccess("establishment", params.id);
  return <ObjectiveSheet cycleId={params.cycleId} ownerType="etablissement" ownerId={params.id} basePath={`/establishments/${params.id}/objectifs`} backHref={`/establishments/${params.id}/objectifs`} />;
}
