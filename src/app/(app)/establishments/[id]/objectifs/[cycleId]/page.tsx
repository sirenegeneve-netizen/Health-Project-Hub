import { ObjectiveSheet } from "@/components/objectif/ObjectiveSheet";

export const dynamic = "force-dynamic";

export default async function EstablishmentObjectivePage({ params }: { params: { id: string; cycleId: string } }) {
  return <ObjectiveSheet cycleId={params.cycleId} ownerType="etablissement" ownerId={params.id} basePath={`/establishments/${params.id}/objectifs`} backHref={`/establishments/${params.id}/objectifs`} />;
}
