import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { EstablishmentInfoForm } from "@/components/EstablishmentInfoForm";

export const dynamic = "force-dynamic";

export default async function EstablishmentCadragePage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id } });
  if (!establishment) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <EstablishmentInfoForm
        establishment={{
          id: establishment.id,
          name: establishment.name,
          type: establishment.type,
          status: establishment.status,
          localisation: establishment.localisation,
          adresse: establishment.adresse,
          ville: establishment.ville,
          pays: establishment.pays,
          siteWeb: establishment.siteWeb,
          activite: establishment.activite,
          nombreLits: establishment.nombreLits,
          nombrePlaces: establishment.nombrePlaces,
          nombreUtilisateurs: establishment.nombreUtilisateurs,
          dateSignature: establishment.dateSignature ? establishment.dateSignature.toISOString() : null,
          dateDemarrage: establishment.dateDemarrage ? establishment.dateDemarrage.toISOString() : null,
          dateFin: establishment.dateFin ? establishment.dateFin.toISOString() : null,
          montantAnnuel: establishment.montantAnnuel,
          maintenance: establishment.maintenance,
          support: establishment.support,
        }}
      />
    </div>
  );
}
