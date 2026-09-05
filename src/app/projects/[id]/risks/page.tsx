import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { RiskForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["ouvert", "Ouvert"],
  ["en_traitement", "En traitement"],
  ["maitrise", "Maîtrisé"],
  ["cloture", "Clôturé"],
].map(([value, label]) => ({ value, label }));

export default async function RisksPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const risks = await prisma.risk.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-teal-700 mb-4">Risques</h1>
      <RiskForm projectId={params.id} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Description</th>
              <th>Propriétaire</th>
              <th>Criticité</th>
              <th>Plan d'action</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id}>
                <td className="pl-4">
                  {r.description}
                  {r.cause && <div className="text-xs text-ink/50">Cause : {r.cause}</div>}
                </td>
                <td>{r.proprietaire || "—"}</td>
                <td>
                  <Pill text={r.criticite} tone={["forte", "critique"].includes(r.criticite) ? "bad" : "neutral"} />
                </td>
                <td className="text-sm">{r.planAction || "—"}</td>
                <td>
                  <InlineSelect endpoint={`/api/risks/${r.id}`} field="status" value={r.status} options={STATUS_OPTIONS} />
                </td>
              </tr>
            ))}
            {risks.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-ink/50">
                  Aucun risque identifié pour ce projet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
