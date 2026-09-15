import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await prisma.group.findMany({
    include: {
      establishments: true,
      initiatives: { include: { budgetLines: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    groups.map(async (g) => {
      const scores = await Promise.all(g.initiatives.map((i) => computeHealthScore(i.id)));
      const vert = scores.filter((s) => s.level === "vert").length;
      const orange = scores.filter((s) => s.level === "orange").length;
      const rouge = scores.filter((s) => s.level === "rouge").length;
      const budgets = g.initiatives
        .map((i) => computeBudgetSummary(i.budgetInitialEur, i.budgetReviseEur, i.budgetLines))
        .filter((b): b is NonNullable<typeof b> => b !== null);
      const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
      const totalReel = budgets.reduce((s, b) => s + b.reel, 0);
      return { group: g, vert, orange, rouge, totalBudget, totalReel };
    })
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Groupes</h1>
        <p className="text-sm text-muted">Vision consolidée par groupe de santé — établissements, initiatives, santé du portefeuille, budget.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/40">Aucun groupe pour l'instant.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map(({ group, vert, orange, rouge, totalBudget, totalReel }) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="card hover:border-blue transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-medium text-ink text-lg">{group.name}</h2>
              </div>
              <div className="text-sm text-muted mb-3">
                {group.establishments.length} établissement{group.establishments.length > 1 ? "s" : ""} · {group.initiatives.length} initiative
                {group.initiatives.length > 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-3 text-sm mb-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ok" />{vert}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" />{orange}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bad" />{rouge}</span>
              </div>
              {totalBudget > 0 && (
                <div className="text-xs text-ink/50">
                  Budget consolidé : {totalReel.toLocaleString("fr-FR")} € / {totalBudget.toLocaleString("fr-FR")} €
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
