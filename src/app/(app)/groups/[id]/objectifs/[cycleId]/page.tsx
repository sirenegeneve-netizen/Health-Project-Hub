import { ObjectiveSheet } from "@/components/objectif/ObjectiveSheet";
import { requirePageAccess } from "@/lib/pageAccess";

export const dynamic = "force-dynamic";

export default async function GroupObjectivePage({ params }: { params: { id: string; cycleId: string } }) {
  await requirePageAccess("group", params.id);
  return <ObjectiveSheet cycleId={params.cycleId} ownerType="groupe" ownerId={params.id} basePath={`/groups/${params.id}/objectifs`} backHref={`/groups/${params.id}/objectifs`} />;
}
