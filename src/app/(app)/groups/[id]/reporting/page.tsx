import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary } from "@/lib/metrics";
import { GroupTabs } from "@/components/GroupTabs";

export const dynamic = "force-dynamic";

export default async function GroupReportingPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: { initiatives: { include: { budgetLines: true }, orderBy: { name: "asc" } } },
  });
  if (!group) notFound();

  const rows = await Promise.all(
    group.initiatives.map(async (i) => ({
      initiative: i,
      score: await computeHealthScore(i.id),
      budget: computeBudgetSummary(i.budgetInitialEur, i.budgetReviseEur, i.budgetLines),
    }))
  );
  const totalBudget = rows.reduce((s, r) => s + (r.budget?.budget || 0), 0);
  const totalReel = rows.reduce((s, r) => s + (r.budget?.reel || 0), 0);

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <div className="card mb-4">
        <div className="text-xs text-ink/40 mb-1">Budget consolidé du groupe</div>
        <div className="text-lg font-medium text-ink">
          {totalBudget > 0 ? `${totalReel.toLocaleString("fr-FR")} € engagés / ${totalBudget.toLocaleString("fr-FR")} € budgétés` : "Aucun budget renseigné"}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/40">Aucune initiative.</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Initiative</th>
                <th>Santé</th>
                <th>Budget</th>
                <th>Engagé</th>
                <th>Raisons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ initiative: i, score, budget }) => (
                <tr key={i.id}>
                  <td className="pl-4">
                    <Link href={`/initiatives/${i.id}`} className="text-blue hover:underline font-medium">
                      {i.name}
                    </Link>
                  </td>
                  <td>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${score.level === "vert" ? "bg-ok" : score.level === "orange" ? "bg-warn" : "bg-bad"}`} />
                    {score.label}
                  </td>
                  <td className="text-sm">{budget ? `${budget.budget.toLocaleString("fr-FR")} €` : "—"}</td>
                  <td className="text-sm">{budget ? `${budget.reel.toLocaleString("fr-FR")} €` : "—"}</td>
                  <td className="text-xs text-ink/50">{score.reasons.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
