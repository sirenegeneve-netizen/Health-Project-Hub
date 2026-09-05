import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { PortfolioList } from "@/components/PortfolioList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    include: { establishments: { include: { establishment: true } }, budgetLines: true },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(projects.map((p) => computeHealthScore(p.id)));

  const atRisk = scores.filter((s) => s.level === "rouge").length;
  const enCours = projects.filter((p) => p.status === "actif").length;
  const termines = projects.filter((p) => p.status === "cloture").length;

  const budgetSummaries = projects.map((p) => computeBudgetSummary(p.budgetInitialEur, p.budgetReviseEur, p.budgetLines)).filter((b) => b !== null);
  const totalBudget = budgetSummaries.reduce((s, b) => s + b!.budget, 0);
  const totalReel = budgetSummaries.reduce((s, b) => s + b!.reel, 0);

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
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="label mb-2">Portefeuille</div>
          <h1 className="font-display text-4xl text-teal-700 leading-tight">
            {projects.length > 0 ? `${projects.length} projet${projects.length > 1 ? "s" : ""}` : "Votre portefeuille"}
          </h1>
        </div>
        <Link href="/projects/new" className="btn">
          + Nouveau projet
        </Link>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-wrap gap-8 text-sm">
          <span>{enCours} en cours</span>
          {atRisk > 0 && <span className="text-bad">{atRisk} à risque</span>}
          {termines > 0 && <span className="text-ink/50">{termines} terminé(s)</span>}
          {budgetSummaries.length > 0 && (
            <span className="text-ink/50">
              {formatEur(totalReel)} consommés sur {formatEur(totalBudget)} ({budgetSummaries.length}/{projects.length} projet(s) budgétisé(s))
            </span>
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
