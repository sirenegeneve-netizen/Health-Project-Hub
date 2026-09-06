import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { BacklogForm, KpiForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const [backlogItems, kpis] = await Promise.all([
    prisma.backlogItem.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.kpi.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Run & Évolutions</h1>
        <p className="text-sm text-muted">Ce qui continue après la stabilisation : demandes, backlog, indicateurs de suivi.</p>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg text-ink mb-3">Backlog</h2>
        <BacklogForm projectId={params.id} />
        {backlogItems.length > 0 ? (
          <div className="space-y-2">
            {backlogItems.map((b) => (
              <div key={b.id} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{b.demande}</div>
                  <div className="text-xs text-muted">
                    {b.priorite}
                    {b.estimationJh ? ` · ${b.estimationJh} JH est.` : ""}
                    {b.origine ? ` · ${b.origine}` : ""}
                  </div>
                </div>
                <span className="text-xs text-muted capitalize">{b.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Backlog vide.</div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <h2 className="font-display text-lg text-ink mb-3">Indicateurs</h2>
        <KpiForm projectId={params.id} />
        {kpis.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {kpis.map((k) => {
              const overThreshold = k.alertThreshold !== null && k.value >= k.alertThreshold;
              const pctOfTarget = k.target ? Math.round((k.value / k.target) * 100) : null;
              return (
                <div key={k.id} className="card">
                  <div className="label mb-1">{k.name}</div>
                  <div className={`font-display text-2xl ${overThreshold ? "text-bad" : "text-ink"}`}>
                    {k.value}
                    {k.unit && <span className="text-base text-muted ml-1">{k.unit}</span>}
                  </div>
                  {k.target !== null && (
                    <div className="text-xs text-muted mt-1">
                      Objectif : {k.target}
                      {k.unit} {pctOfTarget !== null && `(${pctOfTarget}%)`}
                    </div>
                  )}
                  {k.period && <div className="text-xs text-muted/70 mt-0.5">{k.period}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun indicateur défini pour ce projet.</div>
        )}
      </section>
    </div>
  );
}
