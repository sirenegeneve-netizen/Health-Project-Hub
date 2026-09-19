import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { InstalledProducts } from "@/components/InstalledProducts";
import { EcosystemInterfaces } from "@/components/EcosystemInterfaces";

export const dynamic = "force-dynamic";

export default async function EstablishmentSiPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: {
      installedProducts: { orderBy: { createdAt: "desc" } },
      ecosystemInterfaces: { orderBy: { createdAt: "desc" } },
    },
  });
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

      <div className="space-y-4">
        <InstalledProducts establishmentId={establishment.id} products={establishment.installedProducts} />
        <EcosystemInterfaces establishmentId={establishment.id} interfaces={establishment.ecosystemInterfaces} />
      </div>
    </div>
  );
}
