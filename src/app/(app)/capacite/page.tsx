import { prisma } from "@/lib/db";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { CapacityHeatmap } from "@/components/CapacityHeatmap";
import { ObservedLoadTable } from "@/components/ObservedLoadTable";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { mondayOf, addWeeks, weekLabel, isoDate } from "@/lib/weeks";
import { computeObservedLoad, totalsByActorWeek } from "@/lib/observedLoad";

export const dynamic = "force-dynamic";

const WEEK_COUNT = 10;

export default async function CapacitePage({ searchParams }: { searchParams: { from?: string } }) {
  const scope = await getScope();
  const baseMonday = searchParams.from ? mondayOf(new Date(searchParams.from)) : mondayOf(new Date());
  const weekDates = Array.from({ length: WEEK_COUNT }, (_, i) => addWeeks(baseMonday, i));
  const weeks = weekDates.map((d) => ({ start: isoDate(d), label: weekLabel(d) }));
  const rangeEnd = addWeeks(baseMonday, WEEK_COUNT);

  const [initiatives, actors, allocations, observedEntries] = await Promise.all([
    prisma.initiative.findMany({ where: initiativeScopeWhere(scope), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.actor.findMany({ where: { actif: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
    prisma.actorAllocation.findMany({
      where: { weekStart: { gte: baseMonday, lt: rangeEnd }, initiative: initiativeScopeWhere(scope) },
      include: { initiative: { select: { id: true, name: true } } },
    }),
    computeObservedLoad(baseMonday, rangeEnd, initiativeScopeWhere(scope)),
  ]);
  const observedTotals = totalsByActorWeek(observedEntries);

  const totals: Record<string, Record<string, number>> = {};
  const detail: Record<string, Record<string, { initiativeId: string; initiativeName: string; joursAlloues: number }[]>> = {};
  for (const a of allocations) {
    const wk = isoDate(a.weekStart);
    totals[a.actorId] = totals[a.actorId] || {};
    totals[a.actorId][wk] = (totals[a.actorId][wk] || 0) + a.joursAlloues;
    detail[a.actorId] = detail[a.actorId] || {};
    detail[a.actorId][wk] = detail[a.actorId][wk] || [];
    detail[a.actorId][wk].push({ initiativeId: a.initiativeId, initiativeName: a.initiative.name, joursAlloues: a.joursAlloues });
  }

  const prevFrom = isoDate(addWeeks(baseMonday, -WEEK_COUNT));
  const nextFrom = isoDate(addWeeks(baseMonday, WEEK_COUNT));
  const todayFrom = isoDate(mondayOf(new Date()));

  return (
    <div>
      <PortfolioTabs />
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Charge</h1>
          <p className="text-sm text-muted">
            Jours-homme déclarés par acteur et par semaine, tous établissements confondus{scope.establishmentName && ` — filtré sur ${scope.establishmentName}`}.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/capacite?from=${prevFrom}`} className="btn-secondary">
            ← Semaines précédentes
          </a>
          <a href={`/capacite?from=${todayFrom}`} className="btn-secondary">
            Aujourd'hui
          </a>
          <a href={`/capacite?from=${nextFrom}`} className="btn-secondary">
            Semaines suivantes →
          </a>
        </div>
      </div>

      <CapacityHeatmap weeks={weeks} actors={actors} initiatives={initiatives} totals={totals} detail={detail} />
      <ObservedLoadTable weeks={weeks} actors={actors} totals={observedTotals} />
    </div>
  );
}
