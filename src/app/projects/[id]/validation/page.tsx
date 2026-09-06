import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { AnomalyForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const ANOMALY_STATUS = [
  ["ouverte", "Ouverte"],
  ["en_correction", "En correction"],
  ["corrigee", "Corrigée"],
  ["validee", "Validée"],
].map(([value, label]) => ({ value, label }));

export default async function ValidationPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const anomalies = await prisma.anomaly.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Validation</h1>
        <p className="text-sm text-muted">Ce qui prépare le Go-Live : anomalies identifiées, corrigées, validées.</p>
      </div>

      <section className="mt-8 mb-4">
        <AnomalyForm projectId={params.id} />
        {anomalies.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Description</th>
                  <th>Criticité</th>
                  <th>Responsable</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => (
                  <tr key={a.id} className={a.criticite === "critique" && !["corrigee", "validee"].includes(a.status) ? "bg-bad/5" : ""}>
                    <td className="pl-4">{a.description}</td>
                    <td>
                      <Pill text={a.criticite} tone={a.criticite === "critique" ? "bad" : "neutral"} />
                    </td>
                    <td>{a.responsable || "—"}</td>
                    <td>
                      <InlineSelect endpoint={`/api/anomalies/${a.id}`} field="status" value={a.status} options={ANOMALY_STATUS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-10">Aucune anomalie déclarée.</div>
        )}
      </section>

      <p className="text-xs text-muted/70">
        La stratégie de recette et les scénarios de test détaillés ne sont pas encore modélisés dans l'outil — à prévoir dans
        une prochaine évolution.
      </p>
    </div>
  );
}
