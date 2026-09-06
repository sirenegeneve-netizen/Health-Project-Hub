import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActionForm, DecisionForm } from "@/components/EntityForms";
import { ActionsKanban } from "@/components/ActionsKanban";
import { InlineSelect } from "@/components/InlineSelect";
import { computeRealisationMomentum } from "@/lib/readiness";
import { HealthBadge } from "@/components/HealthBadge";

export const dynamic = "force-dynamic";

const DECISION_STATUS = [
  ["en_attente", "En attente"],
  ["arbitrage_necessaire", "Arbitrage nécessaire"],
  ["decision_prise", "Décision prise"],
].map(([value, label]) => ({ value, label }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function RealisationPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const [actions, decisions, meetings] = await Promise.all([
    prisma.action.findMany({ where: { projectId: params.id }, orderBy: { echeance: "asc" } }),
    prisma.decision.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.meeting.findMany({ where: { projectId: params.id }, orderBy: { date: "desc" }, take: 5 }),
  ]);

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lateActions = actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status)).length;
  const recentActivityCount = await prisma.timelineEvent.count({ where: { projectId: params.id, date: { gte: fourteenDaysAgo } } });
  const readiness = computeRealisationMomentum({ totalActions: actions.length, lateActions, recentActivityCount });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="font-display text-2xl text-ink">Réalisation</h1>
          <p className="text-sm text-muted">Sommes-nous en train d'avancer ?</p>
        </div>
        <HealthBadge level={readiness.level} label={readiness.label} />
      </div>
      <ul className="text-sm text-body mt-3 mb-2 space-y-1">
        {readiness.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-muted">·</span>
            {r}
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Actions</SectionTitle>
          <div className="flex gap-3">
            <Link href={`/projects/${params.id}/planning`} className="text-sm text-blue hover:underline">
              Planning & Gantt →
            </Link>
            <Link href={`/projects/${params.id}/actions`} className="text-sm text-blue hover:underline">
              Vue liste →
            </Link>
          </div>
        </div>
        <ActionForm projectId={params.id} />
        {actions.length > 0 ? (
          <ActionsKanban
            actions={actions.map((a) => ({
              id: a.id,
              title: a.title,
              responsable: a.responsable,
              echeance: a.echeance ? a.echeance.toISOString() : null,
              priority: a.priority,
              status: a.status,
            }))}
          />
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune action pour ce projet.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Décisions</SectionTitle>
        <DecisionForm projectId={params.id} />
        {decisions.length > 0 ? (
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{d.subject}</div>
                  {d.decideur && <div className="text-xs text-muted">Décideur : {d.decideur}</div>}
                </div>
                <InlineSelect endpoint={`/api/decisions/${d.id}`} field="status" value={d.status} options={DECISION_STATUS} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune décision enregistrée.</div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Réunions récentes</SectionTitle>
          <Link href={`/projects/${params.id}/meetings`} className="text-sm text-blue hover:underline">
            Toutes les réunions →
          </Link>
        </div>
        {meetings.length > 0 ? (
          <div className="space-y-2">
            {meetings.map((m) => (
              <Link key={m.id} href={`/projects/${params.id}/meetings/${m.id}`} className="row-link">
                <div className="card flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{m.title}</div>
                    <div className="text-xs text-muted capitalize">{m.type.replace(/_/g, " ")}</div>
                  </div>
                  <span className="text-sm text-muted">{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune réunion planifiée.</div>
        )}
      </section>
    </div>
  );
}
