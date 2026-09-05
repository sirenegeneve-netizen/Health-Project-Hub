import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { PortfolioList } from "@/components/PortfolioList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    include: { establishments: { include: { establishment: true } }, budgetLines: true, actions: true },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(projects.map((p) => computeHealthScore(p.id)));

  const atRisk = scores.filter((s) => s.level === "rouge").length;
  const enCours = projects.filter((p) => p.status === "actif").length;
  const lateActionsTotal = scores.reduce((s, sc) => s + sc.metrics.lateActions, 0);

  const budgetSummaries = projects.map((p) => computeBudgetSummary(p.budgetInitialEur, p.budgetReviseEur, p.budgetLines)).filter((b) => b !== null);
  const totalBudget = budgetSummaries.reduce((s, b) => s + b!.budget, 0);
  const totalReel = budgetSummaries.reduce((s, b) => s + b!.reel, 0);

  const recentEvents = await prisma.timelineEvent.findMany({
    include: { project: true },
    orderBy: { date: "desc" },
    take: 6,
  });

  // Alertes portefeuille : agrégées à partir des vraies raisons calculées par projet.
  const alerts = projects
    .map((p, i) => ({ project: p, score: scores[i] }))
    .filter(({ score }) => score.level !== "vert")
    .flatMap(({ project, score }) =>
      score.reasons
        .filter((r) => !r.startsWith("autonomie") && !r.startsWith("aucun"))
        .map((reason) => ({ project, reason, level: score.level }))
    )
    .slice(0, 6);

  const portfolioProjects = projects.map((p, i) => ({
    id: p.id,
    name: p.name,
    reference: p.reference,
    phase: p.phase,
    status: p.status,
    priority: p.priority,
    targetDate: p.targetDate ? p.targetDate.toISOString() : null,
    establishments: p.establishments.map((e) => e.establishment.name),
    healthLevel: scores[i].level,
    healthLabel: scores[i].label,
    progress: p.actions.length > 0 ? Math.round((p.actions.filter((a) => a.status === "termine").length / p.actions.length) * 100) : null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="label mb-2">Portefeuille</div>
          <h1 className="font-display text-4xl text-teal-700 leading-tight">Vue d'ensemble</h1>
        </div>
        <Link href="/projects/new" className="btn">
          + Nouveau projet
        </Link>
      </div>

      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Projets" value={String(projects.length)} />
          <StatCard label="En cours" value={String(enCours)} />
          {atRisk > 0 && <StatCard label="À risque" value={String(atRisk)} tone="bad" />}
          {lateActionsTotal > 0 && <StatCard label="Actions en retard" value={String(lateActionsTotal)} tone="bad" />}
          {budgetSummaries.length > 0 && (
            <StatCard label="Budget consommé" value={formatEur(totalReel)} sub={`sur ${formatEur(totalBudget)}`} />
          )}
        </div>
      )}

      {(alerts.length > 0 || recentEvents.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {alerts.length > 0 && (
            <div className="card">
              <div className="font-medium text-sm mb-3">Alertes prioritaires</div>
              <ul className="space-y-2.5">
                {alerts.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <Link href={`/projects/${a.project.id}`} className="text-teal-700 hover:underline">
                        {a.project.name}
                      </Link>
                      <div className="text-ink/60">{a.reason}</div>
                    </div>
                    <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${a.level === "rouge" ? "bg-bad" : "bg-warn"}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recentEvents.length > 0 && (
            <div className="card">
              <div className="font-medium text-sm mb-3">Activité récente</div>
              <ul className="space-y-2.5">
                {recentEvents.map((e) => (
                  <li key={e.id} className="text-sm flex justify-between gap-3">
                    <span className="text-ink/70">{e.description}</span>
                    <span className="text-ink/40 shrink-0">{new Date(e.date).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {projects.length > 0 ? (
        <PortfolioList projects={portfolioProjects} />
      ) : (
        <div className="card text-center py-16">
          <p className="text-ink/60 mb-4">Aucun projet pour le moment.</p>
          <Link href="/projects/new" className="btn">
            Créer le premier projet
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`font-display text-2xl mt-1 ${tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-xs text-ink/45 mt-0.5">{sub}</div>}
    </div>
  );
}
