import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { KpiForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function KpisPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const kpis = await prisma.kpi.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-teal-700 mb-4">Indicateurs</h1>
      <KpiForm projectId={params.id} />

      {kpis.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucun indicateur défini pour ce projet.</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {kpis.map((k) => {
            const overThreshold = k.alertThreshold !== null && k.value >= k.alertThreshold;
            const pctOfTarget = k.target ? Math.round((k.value / k.target) * 100) : null;
            return (
              <div key={k.id} className="card">
                <div className="label mb-1">{k.name}</div>
                <div className={`font-display text-3xl ${overThreshold ? "text-bad" : "text-ink"}`}>
                  {k.value}
                  {k.unit && <span className="text-lg text-ink/50 ml-1">{k.unit}</span>}
                </div>
                {k.target !== null && (
                  <div className="text-xs text-ink/50 mt-1">
                    Objectif : {k.target}
                    {k.unit} {pctOfTarget !== null && `(${pctOfTarget}%)`}
                  </div>
                )}
                {k.period && <div className="text-xs text-ink/40 mt-0.5">{k.period}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
