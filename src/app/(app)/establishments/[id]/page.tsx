import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";

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
    },
  });
  if (!establishment) notFound();

  const [openRisks, lateActions] = await Promise.all([
    prisma.risk.count({ where: { establishmentId: params.id, status: { notIn: ["maitrise", "cloture"] } } }),
    prisma.action.count({
      where: { establishmentId: params.id, echeance: { lt: new Date() }, status: { notIn: ["termine", "abandonne"] } },
    }),
  ]);

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
      <div className="text-sm text-muted mb-6">
        <Link href={`/groups/${establishment.groupId}`} className="hover:underline">
          {establishment.group.name}
        </Link>
        {establishment.ville && ` · ${establishment.ville}`}
      </div>

      <EstablishmentTabs establishmentId={establishment.id} />

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Link href={`/establishments/${establishment.id}/initiatives`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Initiatives rattachées</div>
          <div className="text-sm font-medium text-ink">{establishment.initiatives.length}</div>
        </Link>
        <Link href={`/establishments/${establishment.id}/risques`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Risques ouverts</div>
          <div className="text-sm font-medium text-ink">{openRisks}</div>
        </Link>
        <Link href={`/establishments/${establishment.id}/actions`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Actions en retard</div>
          <div className="text-sm font-medium text-ink">{lateActions}</div>
        </Link>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-ink">Initiatives concernées</h3>
          <Link href={`/establishments/${establishment.id}/initiatives`} className="text-xs text-blue hover:underline">
            Voir tout →
          </Link>
        </div>
        {establishment.initiatives.length === 0 ? (
          <p className="text-sm text-ink/40">Aucune initiative rattachée pour l'instant.</p>
        ) : (
          <ul className="space-y-1.5">
            {establishment.initiatives.slice(0, 6).map((ie) => (
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
  );
}
