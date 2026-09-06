import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, computeProgress, formatEur } from "@/lib/metrics";
import { HealthBadge } from "@/components/HealthBadge";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ProjectEditForm } from "@/components/ProjectEditForm";
import { PhaseRail } from "@/components/PhaseRail";

export const dynamic = "force-dynamic";

export default async function ProjectDashboard({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      establishments: { include: { establishment: true } },
      actions: true,
      risks: true,
      decisions: true,
      interfaces: true,
      budgetLines: true,
      baselines: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { date: "desc" }, take: 6 },
    },
  });
  if (!project) notFound();

  const score = await computeHealthScore(project.id);
  const now = new Date();

  const progress = computeProgress(project.actions);
  const budget = computeBudgetSummary(project.budgetInitialEur, project.budgetReviseEur, project.budgetLines);

  const lateActions = project.actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));
  const openRisks = project.risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const criticalRisks = openRisks.filter((r) => ["forte", "critique"].includes(r.criticite));
  const pendingDecisions = project.decisions.filter((d) => d.status !== "decision_prise");
  const blockingInterfaces = project.interfaces.filter((i) => i.isBlocking || i.status === "bloquant");

  const upcoming = project.actions
    .filter((a) => a.echeance && a.echeance >= now && !["termine", "abandonne"].includes(a.status))
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
    .slice(0, 5);

  const alerts: string[] = [];
  if (budget && budget.consumptionRate >= 90) alerts.push(`Budget proche du seuil (${budget.consumptionRate}% consommé)`);
  if (lateActions.length > 0) alerts.push(`${lateActions.length} action(s) en retard`);
  if (criticalRisks.length > 0) alerts.push(`${criticalRisks.length} risque(s) critique(s) non traité(s)`);
  if (blockingInterfaces.length > 0) alerts.push(`${blockingInterfaces.length} interface(s) bloquante(s)`);

  return (
    <div>
      <ProjectTabs projectId={project.id} />

      <div className="flex items-start justify-between gap-6 flex-wrap mb-3">
        <div>
          <div className="text-xs text-ink/45">{project.reference}</div>
          <h1 className="font-display text-3xl text-ink">{project.name}</h1>
        </div>
        <HealthBadge level={score.level} label={score.label} />
      </div>

      <div className="mb-6">
        <PhaseRail phase={project.phase} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/60 mb-8">
        <span>{project.status}</span>
        {progress !== null && <span>Avancement : {progress}%</span>}
        {project.targetDate && <span>Échéance : {new Date(project.targetDate).toLocaleDateString("fr-FR")}</span>}
        {project.chefDeProjet && <span>Responsable : {project.chefDeProjet}</span>}
      </div>

      {/* Synthèse — uniquement les indicateurs disponibles */}
      <div className="flex flex-wrap gap-8 mb-8 pb-8 border-b border-teal-100">
        {progress !== null && <Metric label="Avancement" value={`${progress}%`} />}
        {budget && <Metric label="Budget" value={`${budget.consumptionRate}%`} sub={formatEur(budget.reste) + " restants"} />}
        {project.targetDate && <Metric label="Échéance" value={new Date(project.targetDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} />}
        {openRisks.length > 0 && <Metric label="Risques ouverts" value={String(openRisks.length)} tone={criticalRisks.length > 0 ? "bad" : undefined} />}
      </div>

      {alerts.length > 0 && (
        <div className="mb-8">
          <div className="font-medium text-sm mb-2">Points d'attention</div>
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i} className="text-sm text-bad flex items-start gap-2">
                <span>⚠</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">Prochaines échéances</div>
            <Link href={`/projects/${project.id}/planning`} className="text-xs text-blue hover:underline">
              Planning →
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <ul className="space-y-2">
              {upcoming.map((a) => (
                <li key={a.id} className="flex justify-between text-sm">
                  <span>{a.title}</span>
                  <span className="text-ink/50">{new Date(a.echeance!).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">Aucune échéance à venir renseignée.</p>
          )}
          {pendingDecisions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-teal-50">
              <div className="text-sm text-ink/60 mb-1.5">{pendingDecisions.length} décision(s) en attente</div>
              <Link href={`/projects/${project.id}/decisions`} className="text-xs text-blue hover:underline">
                Voir les décisions →
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">Dernières activités</div>
            <Link href={`/projects/${project.id}/timeline`} className="text-xs text-blue hover:underline">
              Tout voir →
            </Link>
          </div>
          {project.timelineEvents.length > 0 ? (
            <ul className="space-y-2">
              {project.timelineEvents.map((e) => (
                <li key={e.id} className="text-sm flex gap-3">
                  <span className="text-ink/40 w-16 shrink-0">{new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                  <span className="text-ink/70">{e.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">Aucune activité pour le moment.</p>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-teal-100">
        <ProjectEditForm
          project={{
            id: project.id,
            status: project.status,
            phase: project.phase,
            priority: project.priority,
            targetDate: project.targetDate ? project.targetDate.toISOString() : null,
            budgetJh: project.budgetJh,
            jhPlanifies: project.jhPlanifies,
            jhConsommes: project.jhConsommes,
            chefDeProjet: project.chefDeProjet,
            sponsor: project.sponsor,
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`font-display text-2xl mt-0.5 ${tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-xs text-ink/45 mt-0.5">{sub}</div>}
    </div>
  );
}
