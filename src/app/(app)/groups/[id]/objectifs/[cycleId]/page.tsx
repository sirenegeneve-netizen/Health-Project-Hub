import { ObjectiveSheet } from "@/components/objectif/ObjectiveSheet";

export const dynamic = "force-dynamic";

export default async function GroupObjectivePage({ params }: { params: { id: string; cycleId: string } }) {
  return <ObjectiveSheet cycleId={params.cycleId} ownerType="groupe" ownerId={params.id} basePath={`/groups/${params.id}/objectifs`} backHref={`/groups/${params.id}/objectifs`} />;
}
