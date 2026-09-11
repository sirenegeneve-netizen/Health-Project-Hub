import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentInfoForm } from "@/components/EstablishmentInfoForm";
import { EstablishmentContacts } from "@/components/EstablishmentContacts";
import { InstalledProducts } from "@/components/InstalledProducts";
import { EcosystemInterfaces } from "@/components/EcosystemInterfaces";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  hopital: "Hôpital",
  clinique: "Clinique",
  ehpad: "EHPAD",
  cabinet: "Cabinet",
  ght: "GHT",
  autre: "Autre",
};

export default async function EstablishmentDetailPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: {
      group: true,
      initiatives: { include: { initiative: true } },
      installedProducts: { orderBy: { createdAt: "desc" } },
      ecosystemInterfaces: { orderBy: { createdAt: "desc" } },
      actorAffiliations: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!establishment) notFound();

  const existingActors = await prisma.actor.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    distinct: ["name"],
  });

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-2xl text-ink">{establishment.name}</h1>
        {establishment.type && (
          <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5 mt-1.5">{TYPE_LABELS[establishment.type] || establishment.type}</span>
        )}
      </div>
      <div className="text-sm text-muted mb-6">{establishment.group.name}</div>

      <div className="space-y-4">
        <EstablishmentInfoForm establishment={establishment} />

        <div className="grid md:grid-cols-2 gap-4">
          <EstablishmentContacts
            establishmentId={establishment.id}
            affiliations={establishment.actorAffiliations}
            existingActors={existingActors}
          />
          <InstalledProducts establishmentId={establishment.id} products={establishment.installedProducts} />
        </div>

        <EcosystemInterfaces establishmentId={establishment.id} interfaces={establishment.ecosystemInterfaces} />

        <div className="card">
          <h3 className="font-medium text-ink mb-3">Initiatives concernées</h3>
          {establishment.initiatives.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune initiative rattachée pour l'instant.</p>
          ) : (
            <ul className="space-y-1.5">
              {establishment.initiatives.map((ie) => (
                <li key={ie.id}>
                  <Link href={`/initiatives/${ie.initiative.id}`} className="text-sm text-blue hover:underline">
                    {ie.initiative.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
