import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
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
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const deliverables = await prisma.deliverable.findMany({ where: { projectId: params.id }, orderBy: { datePrevue: "asc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-teal-700 mb-4">Livrables</h1>
      <DeliverableForm projectId={params.id} />

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
