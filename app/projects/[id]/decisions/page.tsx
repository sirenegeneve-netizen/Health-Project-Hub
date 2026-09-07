import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { DecisionForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["en_attente", "En attente"],
  ["arbitrage_necessaire", "Arbitrage nécessaire"],
  ["decision_prise", "Décision prise"],
].map(([value, label]) => ({ value, label }));

export default async function DecisionsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const decisions = await prisma.decision.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Décisions</h1>
      <DecisionForm projectId={params.id} />

      <div className="space-y-3">
        {decisions.map((d) => (
          <div key={d.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{d.subject}</div>
                {d.context && <div className="text-sm text-ink/60 mt-1">{d.context}</div>}
                {d.recommendation && <div className="text-sm mt-1">Recommandation : {d.recommendation}</div>}
                {d.decideur && <div className="text-xs text-ink/50 mt-1">Décideur : {d.decideur}</div>}
              </div>
              <InlineSelect endpoint={`/api/decisions/${d.id}`} field="status" value={d.status} options={STATUS_OPTIONS} />
            </div>
          </div>
        ))}
        {decisions.length === 0 && <div className="card text-center text-ink/50">Aucune décision enregistrée.</div>}
      </div>
    </div>
  );
}
