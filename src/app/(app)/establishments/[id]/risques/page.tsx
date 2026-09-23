import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { Pill } from "@/components/Pill";
import { RiskForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function EstablishmentRisquesPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!establishment) notFound();

  const [risks, actors] = await Promise.all([
    prisma.risk.findMany({
      where: { establishmentId: params.id },
      include: { initiative: true, proprietaireActor: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
  ]);
  const openRisks = risks.filter((r) => !["maitrise", "cloture"].includes(r.status));

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <p className="text-sm text-ink/60 mb-4">
        Risques des initiatives tagués pour cet établissement, et risques propres à l'établissement, {openRisks.length} ouvert
        {openRisks.length > 1 ? "s" : ""} sur {risks.length}. Un risque lié à une initiative se crée depuis celle-ci, en le rattachant à cet
        établissement ; un risque propre à l'établissement peut se créer directement ici.
      </p>

      <RiskForm initiativeId="" ownerType="etablissement" ownerId={establishment.id} actors={actors} label="+ Nouveau risque propre à l'établissement" />

      {risks.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucun risque pour cet établissement.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Description</th>
                <th>Initiative</th>
                <th>Propriétaire</th>
                <th>Criticité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td className="pl-4 text-sm">{r.description}</td>
                  <td className="text-sm">
                    {r.initiative ? (
                      <Link href={`/initiatives/${r.initiativeId}/risks`} className="text-blue hover:underline">
                        {r.initiative.name}
                      </Link>
                    ) : (
                      <span className="text-ink/50">Propre à l'établissement</span>
                    )}
                  </td>
                  <td className="text-sm text-ink/60">{r.proprietaireActor?.name || r.proprietaire || "—"}</td>
                  <td>
                    <Pill text={r.criticite} tone={["forte", "critique"].includes(r.criticite) ? "bad" : "neutral"} />
                  </td>
                  <td>
                    <Pill text={r.status.replace(/_/g, " ")} tone={r.status === "cloture" || r.status === "maitrise" ? "ok" : "neutral"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
