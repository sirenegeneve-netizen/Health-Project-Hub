import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GroupTabs } from "@/components/GroupTabs";
import { EstablishmentForm } from "@/components/EstablishmentForm";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  hopital: "Hôpital",
  clinique: "Clinique",
  ehpad: "EHPAD",
  cabinet: "Cabinet",
  ght: "GHT",
  autre: "Autre",
};

export default async function GroupEstablishmentsPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { initiatives: true }, orderBy: { name: "asc" } } },
  });
  if (!group) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <h2 className="font-medium text-ink mb-3">Établissements ({group.establishments.length})</h2>
      <EstablishmentForm groupId={group.id} />

      {group.establishments.length === 0 ? (
        <p className="text-sm text-ink/40">Aucun établissement.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {group.establishments.map((e) => (
            <Link key={e.id} href={`/establishments/${e.id}`} className="card hover:border-blue transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="font-medium text-ink">{e.name}</span>
                {e.type && <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[e.type] || e.type}</span>}
              </div>
              <div className="text-xs text-muted">{e.localisation || "Localisation non renseignée"}</div>
              <div className="text-xs text-ink/40 mt-1">
                {e.initiatives.length} initiative{e.initiatives.length > 1 ? "s" : ""} rattachée{e.initiatives.length > 1 ? "s" : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
