import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { PortfolioList } from "@/components/PortfolioList";
import { IconBadge } from "@/components/IconBadge";
import { getScope, projectScopeWhere } from "@/lib/scope";
import { Briefcase, TriangleAlert, Clock, Euro } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scope = await getScope();

  const projects = await prisma.project.findMany({
    where: projectScopeWhere(scope),
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

  const scopedProject = scope.establishmentId ? { establishments: { some: { establishmentId: scope.establishmentId } } } : undefined;

  const recentEvents = await prisma.timelineEvent.findMany({
    where: scopedProject ? { project: scopedProject } : undefined,
    include: { project: true },
    orderBy: { date: "desc" },
    take: 6,
  });

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [pendingDecisions, dueSoonActions, imminentDeliverables] = await Promise.all([
    prisma.decision.findMany({
      where: { status: { not: "decision_prise" }, ...(scopedProject ? { project: scopedProject } : {}) },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.action.findMany({
      where: {
        echeance: { gte: now, lte: in7Days },
        status: { notIn: ["termine", "abandonne"] },
        ...(scopedProject ? { project: scopedProject } : {}),
      },
      include: { project: true },
      orderBy: { echeance: "asc" },
    }),
    prisma.deliverable.findMany({
      where: {
        datePrevue: { gte: now, lte: in14Days },
        status: { not: "valide" },
        ...(scopedProject ? { project: scopedProject } : {}),
      },
      include: { project: true },
      orderBy: { datePrevue: "asc" },
    }),
  ]);

  const priorities = [
    ...pendingDecisions.map((d) => ({ label: d.subject, projectName: d.project.name, projectId: d.projectId, kind: "Décision à trancher", date: null as string | null })),
    ...dueSoonActions.map((a) => ({ label: a.title, projectName: a.project.name, projectId: a.projectId, kind: "Action due", date: a.echeance!.toISOString() })),
    ...imminentDeliverables.map((d) => ({ label: d.name, projectName: d.project.name, projectId: d.projectId, kind: "Livrable attendu", date: d.datePrevue!.toISOString() })),
  ]
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0))
    .slice(0, 8);

  // Alertes portefeuille : agrégées à partir des vraies raisons calculées par projet.
  const alerts = projects
    .map((p, i) => ({ project: p, score: scores[i] }))
    .filter(({ score }) => score.level !== "vert")
    .flatMap(({ project, score }) =>
      score.reasons
        .filter((r) => !r.toLowerCase().startsWith("autonomie") && !r.toLowerCase().startsWith("aucun"))
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
    chefDeProjet: p.chefDeProjet,
    healthLevel: scores[i].level,
    healthLabel: scores[i].label,
    progress: p.actions.length > 0 ? Math.round((p.actions.filter((a) => a.status === "termine").length / p.actions.length) * 100) : null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="label mb-2">Portefeuille</div>
          <h1 className="font-display text-4xl text-ink leading-tight">Vue d'ensemble</h1>
          {scope.establishmentName && (
            <p className="text-sm text-muted mt-1">Filtré sur {scope.establishmentName}</p>
          )}
        </div>
        <Link href="/projects/new" className="btn">
          + Nouveau projet
        </Link>
      </div>

      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Projets" value={String(projects.length)} icon={Briefcase} color="primary" />
          <StatCard label="En cours" value={String(enCours)} icon={Clock} color="blue" />
          {atRisk > 0 && <StatCard label="À risque" value={String(atRisk)} icon={TriangleAlert} color="red" />}
          {lateActionsTotal > 0 && <StatCard label="Actions en retard" value={String(lateActionsTotal)} icon={TriangleAlert} color="orange" />}
          {budgetSummaries.length > 0 && (
            <StatCard label="Budget consommé" value={formatEur(totalReel)} sub={`sur ${formatEur(totalBudget)}`} icon={Euro} color="neutral" />
          )}
        </div>
      )}

      {(alerts.length > 0 || priorities.length > 0 || recentEvents.length > 0) && (
        <div className="grid md:grid-cols-3 gap-4">
          {alerts.length > 0 && (
            <div className="card">
              <div className="font-medium text-sm mb-3">Santé du portefeuille</div>
              <ul className="space-y-3">
                {alerts.map((a, i) => {
                  const severity = severityFor(a.reason, a.level);
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <Link href={`/projects/${a.project.id}`} className="text-blue hover:underline">
                          {a.project.name}
                        </Link>
                        <div className="text-ink/60">{a.reason}</div>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${severity.cls}`}>{severity.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {priorities.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-sm">Priorités du jour</div>
                <Link href="/me" className="text-xs text-blue hover:underline">
                  Mon activité →
                </Link>
              </div>
              <ul className="space-y-3">
                {priorities.map((p, i) => (
                  <li key={i} className="text-sm">
                    <Link href={`/projects/${p.projectId}`} className="text-blue hover:underline">
                      {p.projectName}
                    </Link>
                    <div className="text-ink/60 flex items-center justify-between gap-2">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted shrink-0">{p.date ? new Date(p.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : p.kind}</span>
                    </div>
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

function severityFor(reason: string, level: "vert" | "orange" | "rouge") {
  const r = reason.toLowerCase();
  if (level === "rouge" && (r.includes("bloquante") || r.includes("critique"))) {
    return { label: "Critique", cls: "bg-bad/10 text-bad" };
  }
  if (r.includes("retard")) return { label: "Haute", cls: "bg-warn/10 text-warn" };
  if (r.includes("décision")) return { label: "Moyenne", cls: "bg-ink/5 text-ink/70" };
  return { label: "Info", cls: "bg-info-50 text-info" };
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: import("lucide-react").LucideIcon;
  color: "primary" | "blue" | "red" | "orange" | "purple" | "neutral" | "green";
}) {
  return (
    <div className="card flex items-start gap-3">
      <IconBadge color={color} icon={icon} />
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="font-display text-2xl mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
