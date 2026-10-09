import Link from "next/link";
import { prisma } from "@/lib/db";
import { StrategicPlanForm } from "@/components/GovernanceForms";
import { ObjectiveCreateForm } from "@/components/objectif/ObjectiveCreateForm";

// Page « Nouvel objectif stratégique » (groupe ou établissement).
export async function ObjectiveNew({ ownerType, ownerId, basePath, backHref }: { ownerType: "groupe" | "etablissement"; ownerId: string; basePath: string; backHref: string }) {
  const [plans, actors, establishmentCount] = await Promise.all([
    prisma.strategicPlan.findMany({ where: { ownerType, ownerId, statut: { not: "clos" } }, orderBy: { startDate: "desc" }, select: { id: true, libelle: true } }),
    prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
    ownerType === "groupe" ? prisma.establishment.count({ where: { groupId: ownerId } }) : Promise.resolve(0),
  ]);
  return (
    <div>
      <Link href={backHref} className="text-sm text-blue hover:underline">
        ← Objectifs & conformité
      </Link>
      <h1 className="font-display text-2xl text-ink mt-2 mb-5">Nouvel objectif stratégique</h1>
      {plans.length === 0 ? (
        <div className="card max-w-xl space-y-3">
          <p className="text-sm text-body">Un objectif s'inscrit dans un plan stratégique. Créez d'abord le plan, puis revenez ici.</p>
          <StrategicPlanForm ownerType={ownerType} ownerId={ownerId} establishmentCount={establishmentCount} />
        </div>
      ) : (
        <ObjectiveCreateForm ownerType={ownerType} ownerId={ownerId} plans={plans} actors={actors} establishmentCount={establishmentCount} basePath={basePath} />
      )}
    </div>
  );
}
