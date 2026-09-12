import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { DeliverableForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["a_venir", "À venir"],
  ["en_cours", "En cours"],
  ["valide", "Validé"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

export default async function DeliverablesPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: params.id } });
  if (!initiative) notFound();
  const deliverables = await prisma.deliverable.findMany({ where: { initiativeId: params.id }, orderBy: { datePrevue: "asc" } });
  const actors = await findInitiativeActors(params.id, { id: true, name: true });

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Livrables</h1>
      <DeliverableForm initiativeId={params.id} actors={actors} />

      {deliverables.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Livrable</th>
                <th>Responsable</th>
                <th>Version</th>
                <th>Date prévue</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d) => (
                <tr key={d.id}>
                  <td className="pl-4 font-medium">{d.name}</td>
                  <td>{d.responsable || "—"}</td>
                  <td>{d.version || "—"}</td>
                  <td>{d.datePrevue ? new Date(d.datePrevue).toLocaleDateString("fr-FR") : "—"}</td>
                  <td>
                    <InlineSelect endpoint={`/api/deliverables/${d.id}`} field="status" value={d.status} options={STATUS_OPTIONS} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center text-ink/50 py-10">Aucun livrable identifié pour ce projet.</div>
      )}
    </div>
  );
}
