import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { BudgetTargetsForm, BudgetLineForm, BudgetLinesTable } from "@/components/BudgetForms";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function BudgetPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { budgetLines: { orderBy: { createdAt: "desc" } } } });
  if (!project) notFound();

  const summary = computeBudgetSummary(project.budgetInitialEur, project.budgetReviseEur, project.budgetLines);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-teal-700 mb-4">Budget</h1>

      <BudgetTargetsForm projectId={params.id} budgetInitialEur={project.budgetInitialEur} budgetReviseEur={project.budgetReviseEur} />

      {summary ? (
        <div className="card mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
            <Figure label="Budget" value={formatEur(summary.budget)} />
            <Figure label="Engagé" value={formatEur(summary.engage)} />
            <Figure label="Réel" value={formatEur(summary.reel)} tone={summary.reel > summary.budget ? "bad" : undefined} />
            <Figure label="Reste" value={formatEur(summary.reste)} tone={summary.reste < 0 ? "bad" : "ok"} />
          </div>
          <div className="h-2 rounded-full bg-teal-50 overflow-hidden">
            <div
              className={`h-full rounded-full ${summary.consumptionRate > 100 ? "bg-bad" : summary.consumptionRate > 85 ? "bg-warn" : "bg-teal-600"}`}
              style={{ width: `${Math.min(summary.consumptionRate, 100)}%` }}
            />
          </div>
          <div className="text-xs text-ink/50 mt-1.5">{summary.consumptionRate}% consommé</div>
        </div>
      ) : (
        <div className="card text-center py-10 mb-6">
          <p className="text-ink/60 mb-1">Aucun budget renseigné pour ce projet.</p>
          <p className="text-sm text-ink/40">Définissez un budget cible ci-dessus pour suivre la consommation.</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Lignes budgétaires</h2>
      </div>
      <BudgetLineForm projectId={params.id} />

      {project.budgetLines.length > 0 ? (
        <BudgetLinesTable lines={project.budgetLines} />
      ) : (
        <div className="card text-center text-ink/50 py-8">Aucune ligne budgétaire pour l'instant.</div>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const cls = tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`font-display text-2xl mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
