import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { findSinglePointsOfFailure } from "@/lib/resourceGovernance";
import { computeDimensionColors } from "@/lib/portfolioHealth";
import { detectResourceConflicts, detectScheduleConflicts } from "@/lib/portfolioConflicts";
import { getLifecycleStages } from "@/lib/lifecycle";
import { PortfolioList } from "@/components/PortfolioList";
import { PortfolioHealthTable, type HealthRow } from "@/components/PortfolioHealthTable";
import { IconBadge } from "@/components/IconBadge";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { Briefcase, TriangleAlert, Clock, Euro, Ban, GitFork, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scope = await getScope();

  const initiatives = await prisma.initiative.findMany({
    where: initiativeScopeWhere(scope),
    include: {
      establishments: { include: { establishment: true } },
      budgetLines: true,
      actions: true,
      risks: true,
      interfaces: true,
      deliverables: true,
      actors: true,
      raciEntries: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));

  const atRisk = scores.filter((s) => s.level === "rouge").length;
  const enCours = initiatives.filter((p) => p.status === "actif").length;
  const lateActionsTotal = scores.reduce((s, sc) => s + sc.metrics.lateActions, 0);
  const blockedCount = scores.filter((s) => s.metrics.blockingInterfaces > 0).length;

  const budgetSummaries = initiatives.map((p) => computeBudgetSummary(p.budgetInitialEur, p.budgetReviseEur, p.budgetLines));
  const totalBudget = budgetSummaries.reduce((s, b) => s + (b?.budget ?? 0), 0);
  const totalReel = budgetSummaries.reduce((s, b) => s + (b?.reel ?? 0), 0);

  // Dépendances critiques : activités RACI portées par un seul acteur ("R"),
  // agrégées sur tout le périmètre — cf. §11/§F du diagnostic.
  const criticalDependencies = initiatives.reduce((sum, p) => {
    const actorsById = new Map(p.actors.map((a) => [a.id, a.name]));
    return sum + findSinglePointsOfFailure(p.raciEntries, actorsById).length;
  }, 0);

  const scopedInitiative = scope.establishmentId ? { establishments: { some: { establishmentId: scope.establishmentId } } } : undefined;

  const recentEvents = await prisma.timelineEvent.findMany({
    where: scopedInitiative ? { initiative: scopedInitiative } : undefined,
    include: { initiative: true },
    orderBy: { date: "desc" },
    take: 6,
  });

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [pendingDecisions, dueSoonActions, imminentDeliverables] = await Promise.all([
    prisma.decision.findMany({
      where: { status: { not: "decision_prise" }, ...(scopedInitiative ? { initiative: scopedInitiative } : {}) },
      include: { initiative: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.action.findMany({
      where: {
        echeance: { gte: now, lte: in7Days },
        status: { notIn: ["termine", "abandonne"] },
        ...(scopedInitiative ? { initiative: scopedInitiative } : {}),
      },
      include: { initiative: true },
      orderBy: { echeance: "asc" },
    }),
    prisma.deliverable.findMany({
      where: {
        datePrevue: { gte: now, lte: in14Days },
        status: { not: "valide" },
        ...(scopedInitiative ? { initiative: scopedInitiative } : {}),
      },
      include: { initiative: true },
      orderBy: { datePrevue: "asc" },
    }),
  ]);

  const priorities = [
    ...pendingDecisions.map((d) => ({ label: d.subject, initiativeName: d.initiative.name, initiativeId: d.initiativeId, kind: "Décision à trancher", date: null as string | null, href: `/initiatives/${d.initiativeId}/decisions` })),
    ...dueSoonActions.map((a) => ({ label: a.title, initiativeName: a.initiative.name, initiativeId: a.initiativeId, kind: "Action due", date: a.echeance!.toISOString(), href: `/initiatives/${a.initiativeId}/actions` })),
    ...imminentDeliverables.map((d) => ({ label: d.name, initiativeName: d.initiative.name, initiativeId: d.initiativeId, kind: "Livrable attendu", date: d.datePrevue!.toISOString(), href: `/initiatives/${d.initiativeId}/conception` })),
  ]
    .sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0))
    .slice(0, 8);

  // Alertes portefeuille : agrégées à partir des vraies raisons calculées par projet.
  const alerts = initiatives
    .map((p, i) => ({ initiative: p, score: scores[i] }))
    .filter(({ score }) => score.level !== "vert")
    .flatMap(({ initiative, score }) =>
      score.reasons
        .filter((r) => !r.toLowerCase().startsWith("autonomie") && !r.toLowerCase().startsWith("aucun"))
        .map((reason) => ({ initiative, reason, level: score.level }))
    )
    .slice(0, 6);

  const portfolioInitiatives = initiatives.map((p, i) => {
    const stages = getLifecycleStages(p.phase);
    const currentStage = stages.find((s) => s.status === "current") || stages[0];
    return {
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
      stageLabel: currentStage.label,
    };
  });

  const healthRows: HealthRow[] = initiatives.map((p, i) => {
    const dims = computeDimensionColors(
      scores[i],
      budgetSummaries[i],
      p.actors,
      { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      p.raciEntries
    );
    return {
      id: p.id,
      name: p.name,
      progress: portfolioInitiatives[i].progress,
      ...dims,
      sante: scores[i].level,
      santeLabel: scores[i].label,
    };
  });

  const resourceConflicts = detectResourceConflicts(
    initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      actors: p.actors,
      workloadInputs: { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      raciEntries: p.raciEntries,
    }))
  );
  const scheduleConflicts = detectScheduleConflicts(
    initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      targetDate: p.targetDate,
      establishments: p.establishments.map((e) => e.establishment),
    }))
  );

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
        <Link href="/initiatives/new" className="btn">
          + Nouveau projet
        </Link>
      </div>

      {initiatives.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Projets" value={String(initiatives.length)} icon={Briefcase} color="primary" href="/initiatives" />
          <StatCard label="En cours" value={String(enCours)} icon={Clock} color="blue" href="/initiatives?vue=actifs" />
          {atRisk > 0 && <StatCard label="À risque" value={String(atRisk)} icon={TriangleAlert} color="red" href="/initiatives?vue=a_risque" />}
          {blockedCount > 0 && <StatCard label="Projets bloqués" value={String(blockedCount)} icon={Ban} color="red" href="/initiatives?vue=bloques" />}
          {lateActionsTotal > 0 && <StatCard label="Actions en retard" value={String(lateActionsTotal)} icon={TriangleAlert} color="orange" href="/actions?filtre=retard" />}
          {criticalDependencies > 0 && (
            <StatCard label="Dépendances critiques" value={String(criticalDependencies)} icon={GitFork} color="purple" href="/resources?vue=dependances" />
          )}
          {totalBudget > 0 && (
            <StatCard label="Budget consommé" value={formatEur(totalReel)} sub={`sur ${formatEur(totalBudget)}`} icon={Euro} color="neutral" />
          )}
        </div>
      )}

      {healthRows.length > 0 && <PortfolioHealthTable rows={healthRows} />}

      {(alerts.length > 0 || priorities.length > 0 || recentEvents.length > 0) && (
        <div className="grid md:grid-cols-3 gap-4">
          {alerts.length > 0 && (
            <div className="card">
              <div className="font-medium text-sm mb-3">Alertes</div>
              <ul className="space-y-3">
                {alerts.map((a, i) => {
                  const severity = severityFor(a.reason, a.level);
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <Link href={`/initiatives/${a.initiative.id}`} className="text-blue hover:underline">
                          {a.initiative.name}
                        </Link>
                        <div className="text-ink/60">
                          <Link href={reasonHref(a.initiative.id, a.reason)} className="hover:underline hover:text-ink">
                            {a.reason}
                          </Link>
                        </div>
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
                    <Link href={`/initiatives/${p.initiativeId}`} className="text-blue hover:underline">
                      {p.initiativeName}
                    </Link>
                    <div className="text-ink/60 flex items-center justify-between gap-2">
                      <Link href={p.href} className="hover:underline hover:text-ink">
                        {p.label}
                      </Link>
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

      {(resourceConflicts.length > 0 || scheduleConflicts.length > 0) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <IconBadge color="orange" icon={Users} />
            <div className="font-medium text-sm">Conflits interprojets</div>
          </div>
          <p className="text-xs text-ink/40 mb-4">
            Détection par rapprochement de nom — indicative tant que les ressources ne sont pas rattachées au groupe (Phase 4).
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {resourceConflicts.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-ink/40 font-medium mb-2">Ressources partagées en tension</div>
                <ul className="space-y-3">
                  {resourceConflicts.map((c, i) => (
                    <li key={i} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.level === "rouge" ? "bg-bad" : "bg-warn"}`} />
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className="text-ink/40 text-xs">{c.combinedWorkload} objets ouverts cumulés</span>
                      </div>
                      <div className="text-ink/60 text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-4">
                        {c.initiatives.map((p) => (
                          <Link key={p.id} href={`/initiatives/${p.id}`} className="hover:underline hover:text-primary">
                            {p.name} ({p.workload})
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scheduleConflicts.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-ink/40 font-medium mb-2">Échéances concentrées</div>
                <ul className="space-y-3">
                  {scheduleConflicts.map((c, i) => (
                    <li key={i} className="text-sm">
                      <div className="font-medium text-ink">{c.establishmentName}</div>
                      <div className="text-ink/60 text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {c.initiatives.map((p) => (
                          <Link key={p.id} href={`/initiatives/${p.id}`} className="hover:underline hover:text-primary">
                            {p.name} — {new Date(p.targetDate).toLocaleDateString("fr-FR")}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {initiatives.length > 0 ? (
        <PortfolioList initiatives={portfolioInitiatives} />
      ) : (
        <div className="card text-center py-16">
          <p className="text-ink/60 mb-4">Aucun projet pour le moment.</p>
          <Link href="/initiatives/new" className="btn">
            Créer le premier projet
          </Link>
        </div>
      )}
    </div>
  );
}

function reasonHref(initiativeId: string, reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("retard")) return `/initiatives/${initiativeId}/actions`;
  if (r.includes("risque")) return `/initiatives/${initiativeId}/risks`;
  if (r.includes("décision")) return `/initiatives/${initiativeId}/decisions`;
  if (r.includes("interface") || r.includes("bloquante")) return `/initiatives/${initiativeId}/interfaces`;
  if (r.includes("budget")) return `/initiatives/${initiativeId}/budget`;
  if (r.includes("planning")) return `/initiatives/${initiativeId}/planning`;
  return `/initiatives/${initiativeId}`;
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
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: import("lucide-react").LucideIcon;
  color: "primary" | "blue" | "red" | "orange" | "purple" | "neutral" | "green";
  href?: string;
}) {
  const content = (
    <div className="card flex items-start gap-3 h-full">
      <IconBadge color={color} icon={icon} />
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="font-display text-2xl mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80 transition-opacity">
      {content}
    </Link>
  ) : (
    content
  );
}
