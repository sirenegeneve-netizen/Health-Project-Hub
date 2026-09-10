import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { StageCriteriaList } from "@/components/StageCriteriaList";
import { ensureStageCriteria, computeStageCompletion } from "@/lib/stageCriteria";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

// Étape Clôture (§14 du prompt de refonte) : bilan de fin de projet. Les
// compteurs (actions ouvertes, risques résiduels, budget) sont recalculés à
// partir des données réelles et affichés à titre indicatif ; la décision de
// considérer chaque point comme réglé reste manuelle (checklist).
export default async function CloturePage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { budgetLines: true } });
  if (!project) notFound();

  await ensureStageCriteria(params.id, "cloture");

  const [criteria, openActions, openRisks] = await Promise.all([
    prisma.stageCriterion.findMany({ where: { projectId: params.id, stageKey: "cloture" }, orderBy: { order: "asc" } }),
    prisma.action.count({ where: { projectId: params.id, status: { notIn: ["termine", "abandonne"] } } }),
    prisma.risk.count({ where: { projectId: params.id, status: { notIn: ["maitrise", "cloture"] } } }),
  ]);

  const { percent, blocked } = computeStageCompletion(criteria);
  const budget = computeBudgetSummary(project.budgetInitialEur, project.budgetReviseEur, project.budgetLines);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">Clôture</h1>
        <Pill text={`${percent}% du bilan`} tone={blocked ? "bad" : percent === 100 ? "ok" : "warn"} />
      </div>
      <p className="text-sm text-muted mb-6">Bilan de fin de projet et transfert au support / à l'exploitation.</p>

      <div className="flex flex-wrap gap-8 mb-6 pb-6 border-b border-teal-100">
        <div>
          <div className="text-xs text-ink/50">Actions ouvertes</div>
          <div className={`text-lg font-medium ${openActions > 0 ? "text-warn" : "text-ok"}`}>{openActions}</div>
        </div>
        <div>
          <div className="text-xs text-ink/50">Risques résiduels</div>
          <div className={`text-lg font-medium ${openRisks > 0 ? "text-warn" : "text-ok"}`}>{openRisks}</div>
        </div>
        {budget && (
          <div>
            <div className="text-xs text-ink/50">Budget final</div>
            <div className="text-lg font-medium text-ink">{formatEur(budget.reel)}</div>
          </div>
        )}
      </div>

      <div className="card">
        <StageCriteriaList criteria={criteria} />
      </div>

      <p className="text-sm text-ink/50 mt-4">
        Détail des actions et risques restants dans les onglets{" "}
        <Link href={`/projects/${params.id}/actions`} className="text-blue hover:underline">Déploiement</Link>{" "}
        et{" "}
        <Link href={`/projects/${params.id}/risks`} className="text-blue hover:underline">Risques</Link>.
      </p>
    </div>
  );
}
