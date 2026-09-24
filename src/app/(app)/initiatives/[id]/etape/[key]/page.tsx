import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { getWorkflowStages } from "@/lib/workflowStages";
import { stageGuidance } from "@/lib/stageGuidance";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { ActionForm, DecisionForm, RiskForm } from "@/components/EntityForms";
import { ActionsKanban } from "@/components/ActionsKanban";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const DECISION_STATUS = [
  ["en_attente", "En attente"],
  ["arbitrage_necessaire", "Arbitrage nécessaire"],
  ["decision_prise", "Décision prise"],
].map(([value, label]) => ({ value, label }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function StagePage({ params }: { params: { id: string; key: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    select: { id: true, type: true, phase: true, establishments: { include: { establishment: true } } },
  });
  if (!initiative) notFound();
  // Le Déploiement garde ses 8 pages dédiées existantes (kickoff, preparation...) —
  // cette page générique ne sert que les 9 autres types.
  if (initiative.type === "deploiement") notFound();

  const stages = await getWorkflowStages(initiative.type);
  const stageIndex = stages.findIndex((s) => s.key === params.key);
  const stage = stageIndex >= 0 ? stages[stageIndex] : null;
  if (!stage) notFound();

  const actors = await findInitiativeActors(params.id, { id: true, name: true });
  const establishments = initiative.establishments.map((e) => ({ id: e.establishmentId, name: e.establishment.name }));

  const [actions, risks, decisions, meetings] = await Promise.all([
    prisma.action.findMany({ where: { initiativeId: params.id }, orderBy: { echeance: "asc" } }),
    prisma.risk.findMany({ where: { initiativeId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.decision.findMany({ where: { initiativeId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.meeting.findMany({ where: { initiativeId: params.id }, orderBy: { date: "desc" }, take: 5 }),
  ]);
  const openRisks = risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const isCurrentStage = initiative.phase === stage.key || stage.legacyPhases.includes(initiative.phase);
  const prev = stageIndex > 0 ? stages[stageIndex - 1] : null;
  const next = stageIndex < stages.length - 1 ? stages[stageIndex + 1] : null;

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-ink/40">
              Étape {stageIndex + 1}/{stages.length}
            </span>
            {isCurrentStage && <Pill text="Étape en cours" tone="ok" />}
          </div>
          <h1 className="font-display text-2xl text-ink">{stage.label}</h1>
          <p className="text-sm text-muted mt-1">{stageGuidance(stage.key)}</p>
        </div>
        <div className="flex gap-3 text-sm">
          {prev && (
            <Link href={`/initiatives/${params.id}/etape/${prev.key}`} className="text-blue hover:underline">
              ← {prev.label}
            </Link>
          )}
          {next && (
            <Link href={`/initiatives/${params.id}/etape/${next.key}`} className="text-blue hover:underline">
              {next.label} →
            </Link>
          )}
        </div>
      </div>

      <p className="text-xs text-ink/45 mt-3 mb-6">
        Actions, risques, décisions et réunions ci-dessous concernent l'ensemble de l'initiative — le suivi n'est pas encore filtré étape
        par étape.
      </p>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Actions</SectionTitle>
          <div className="flex gap-3">
            <Link href={`/initiatives/${params.id}/planning`} className="text-sm text-blue hover:underline">
              Planning & Gantt →
            </Link>
            <Link href={`/initiatives/${params.id}/actions`} className="text-sm text-blue hover:underline">
              Vue liste →
            </Link>
          </div>
        </div>
        <ActionForm initiativeId={params.id} actors={actors} establishments={establishments} />
        {actions.length > 0 ? (
          <ActionsKanban
            actions={actions.map((a) => ({
              id: a.id,
              title: a.title,
              responsable: a.responsable,
              echeance: a.echeance ? a.echeance.toISOString() : null,
              priority: a.priority,
              status: a.status,
              establishmentName: establishments.find((e) => e.id === a.establishmentId)?.name || null,
            }))}
          />
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune action pour cette initiative.</div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Risques {openRisks.length > 0 && <span className="text-ink/40 font-normal">({openRisks.length} ouvert{openRisks.length > 1 ? "s" : ""})</span>}</SectionTitle>
          <Link href={`/initiatives/${params.id}/risks`} className="text-sm text-blue hover:underline">
            Vue liste →
          </Link>
        </div>
        <RiskForm initiativeId={params.id} actors={actors} establishments={establishments} />
        {risks.length > 0 ? (
          <div className="space-y-2">
            {risks.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{r.description}</div>
                  {r.proprietaire && <div className="text-xs text-muted">Propriétaire : {r.proprietaire}</div>}
                </div>
                <Pill text={r.criticite} tone={["forte", "critique"].includes(r.criticite) ? "bad" : "neutral"} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun risque identifié.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Décisions</SectionTitle>
        <DecisionForm initiativeId={params.id} actors={actors} />
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
          <Link href={`/initiatives/${params.id}/meetings`} className="text-sm text-blue hover:underline">
            Toutes les réunions →
          </Link>
        </div>
        {meetings.length > 0 ? (
          <div className="space-y-2">
            {meetings.map((m) => (
              <Link key={m.id} href={`/initiatives/${params.id}/meetings/${m.id}`} className="row-link">
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
