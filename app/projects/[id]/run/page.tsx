import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { BacklogForm, KpiForm } from "@/components/EntityForms";
import { computeStabilityReadiness, computeBacklogTriage } from "@/lib/readiness";
import { HealthBadge } from "@/components/HealthBadge";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { interfaces: true, risks: true, trainings: true } });
  if (!project) notFound();

  const [backlogItems, kpis] = await Promise.all([
    prisma.backlogItem.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.kpi.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const blockingInterfaces = project.interfaces.filter((i) => i.isBlocking || i.status === "bloquant").length;
  const criticalOpenRisks = project.risks.filter((r) => ["forte", "critique"].includes(r.criticite) && !["maitrise", "cloture"].includes(r.status)).length;
  const totalUsers = project.trainings.reduce((s, t) => s + t.nbUsers, 0);
  const totalAutonomous = project.trainings.reduce((s, t) => s + (t.autonomyLevel >= 2 ? t.nbFormes : 0), 0);
  const autonomyRate = totalUsers > 0 ? totalAutonomous / totalUsers : null;
  const stability = computeStabilityReadiness({ blockingInterfaces, criticalOpenRisks, autonomyRate });

  const untriaged = backlogItems.filter((b) => b.status === "nouveau").length;
  const triage = computeBacklogTriage(untriaged);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="font-display text-2xl text-ink">Run & Évolutions</h1>
          <p className="text-sm text-muted">Le projet est-il stabilisé ?</p>
        </div>
        <HealthBadge level={stability.level} label={stability.label} />
      </div>
      <ul className="text-sm text-body mt-3 mb-2 space-y-1">
        {stability.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-muted">·</span>
            {r}
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg text-ink">Backlog</h2>
          <HealthBadge level={triage.level} label={triage.label} />
        </div>
        <p className="text-sm text-muted mb-3">Que doit-on améliorer ?</p>
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
