import { getTypeLabels } from "@/lib/projectTypeLabels";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { computeStages } from "@/lib/lifecycle";
import { getInitiativeStagesMap } from "@/lib/templateEngine";
import { InitiativesExplorer, type ExplorerInitiative } from "@/components/InitiativesExplorer";
import { PortfolioTabs } from "@/components/PortfolioTabs";

export const dynamic = "force-dynamic";


export default async function InitiativesPage({ searchParams }: { searchParams: { vue?: string } }) {
  const TYPE_LABELS = await getTypeLabels();
  const scope = await getScope();

  const initiatives = await prisma.initiative.findMany({
    where: initiativeScopeWhere(scope),
    include: { establishments: { include: { establishment: true } }, actions: true, group: true },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));
  const stagesById = await getInitiativeStagesMap(initiatives.map((p) => ({ id: p.id, type: p.type })));

  const now = new Date();
  const items: ExplorerInitiative[] = initiatives.map((p, i) => {
    const stages = computeStages(p.phase, stagesById.get(p.id) ?? []);
    const currentIdx = stages.findIndex((s) => s.status === "current");
    return {
      id: p.id,
      name: p.name,
      reference: p.reference,
      type: p.type,
      typeLabel: TYPE_LABELS[p.type] || p.type,
      status: p.status,
      priority: p.priority,
      chefDeProjet: p.chefDeProjet,
      groupName: p.group.name,
      targetDate: p.targetDate ? p.targetDate.toISOString() : null,
      late: !!(p.targetDate && p.targetDate < now && p.status !== "cloture"),
      establishments: p.establishments.map((e) => e.establishment.name),
      healthLevel: scores[i].level,
      healthLabel: scores[i].label,
      blocked: scores[i].metrics.blockingInterfaces > 0,
      progress: p.actions.length > 0 ? Math.round((p.actions.filter((a) => a.status === "termine").length / p.actions.length) * 100) : null,
      stageLabel: currentIdx >= 0 ? stages[currentIdx].label : stages[0].label,
    };
  });

  return (
    <div>
      <PortfolioTabs />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Initiatives</h1>
        <p className="text-sm text-muted">
          {scope.establishmentName
            ? `Toutes les initiatives de ${scope.establishmentName}.`
            : "Toutes les initiatives du groupe, tous établissements confondus."}
        </p>
      </div>
      <InitiativesExplorer initiatives={items} initialTab={searchParams.vue} />
    </div>
  );
}
