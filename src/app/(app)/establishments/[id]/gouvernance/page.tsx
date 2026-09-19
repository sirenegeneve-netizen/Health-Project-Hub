import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { EstablishmentContacts } from "@/components/EstablishmentContacts";

export const dynamic = "force-dynamic";

export default async function EstablishmentGouvernancePage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: { actorAffiliations: { include: { actor: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!establishment) notFound();

  const existingActors = await prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] });

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <EstablishmentContacts
        establishmentId={establishment.id}
        affiliations={establishment.actorAffiliations}
        existingActors={existingActors}
      />
    </div>
  );
}
