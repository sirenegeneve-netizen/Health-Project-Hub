import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { HealthBadge } from "@/components/HealthBadge";
import { Pill, statusTone } from "@/components/Pill";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ProjectEditForm } from "@/components/ProjectEditForm";

export const dynamic = "force-dynamic";

export default async function ProjectDashboard({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      establishments: { include: { establishment: true } },
      actions: true,
      risks: true,
      decisions: true,
      interfaces: true,
      trainings: true,
      baselines: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { date: "desc" }, take: 8 },
    },
  });
  if (!project) notFound();

  const score = await computeHealthScore(project.id);
  const now = new Date();

  const lateActions = project.actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));
  const openRisks = project.risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const pendingDecisions = project.decisions.filter((d) => d.status !== "decision_prise");
  const blockingInterfaces = project.interfaces.filter((i) => i.isBlocking || i.status === "bloquant");

  const initialBaseline = project.baselines[0];
  const consumptionPct = project.budgetJh > 0 ? Math.round((project.jhConsommes / project.budgetJh) * 100) : 0;

  return (
    <div>
      <ProjectTabs projectId={project.id} />

      <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
        <div>
          <div className="text-xs text-ink/50">{project.reference}</div>
          <h1 className="font-display text-3xl text-teal-700">{project.name}</h1>
          <p className="text-ink/60 mt-1 max-w-2xl">{project.description}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Pill text={project.phase.replace(/_/g, " ")} />
            <Pill text={project.priority} tone={project.priority === "critique" ? "bad" : "neutral"} />
            <Pill text={project.status} />
            <span className="text-sm text-ink/60">
              {project.establishments.map((e) => e.establishment.name).join(", ")}
            </span>
          </div>
        </div>
        <HealthBadge level={score.level} label={score.label} />
      </div>

      <div className="card mb-6">
        <div className="font-medium mb-2">Pourquoi ce niveau ?</div>
        <ul className="text-sm text-ink/70 list-disc pl-5 space-y-1">
          {score.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="label mb-2">Planning</div>
          <div className="text-sm space-y-1">
            <div>Baseline initiale : {initialBaseline ? new Date(initialBaseline.targetDate).toLocaleDateString("fr-FR") : "—"}</div>
            <div>Date cible actuelle : {project.targetDate ? new Date(project.targetDate).toLocaleDateString("fr-FR") : "—"}</div>
            {score.metrics.planningDeltaDays !== null && (
              <div className={score.metrics.planningDeltaDays > 0 ? "text-bad" : "text-ok"}>
                Écart : {score.metrics.planningDeltaDays > 0 ? "+" : ""}
                {score.metrics.planningDeltaDays} j
              </div>
            )}
            <div className="text-ink/50">{project.baselines.length} baseline(s) enregistrée(s)</div>
          </div>
        </div>
        <div className="card">
          <div className="label mb-2">Jours-homme</div>
          <div className="text-sm space-y-1">
            <div>Budgétés : {project.budgetJh}</div>
            <div>Consommés : {project.jhConsommes} ({consumptionPct}%)</div>
            <div>Restants : {Math.max(project.budgetJh - project.jhConsommes, 0)}</div>
          </div>
        </div>
        <div className="card">
          <div className="label mb-2">Acteurs</div>
          <div className="text-sm space-y-1">
            <div>Chef de projet : {project.chefDeProjet || "—"}</div>
            <div>Sponsor : {project.sponsor || "—"}</div>
          </div>
        </div>
      </div>

      <ProjectEditForm
        project={{
          id: project.id,
          status: project.status,
          phase: project.phase,
          priority: project.priority,
          targetDate: project.targetDate ? project.targetDate.toISOString() : null,
          budgetJh: project.budgetJh,
          jhPlanifies: project.jhPlanifies,
          jhConsommes: project.jhConsommes,
          chefDeProjet: project.chefDeProjet,
          sponsor: project.sponsor,
        }}
      />

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <QuickList title={`Actions en retard (${lateActions.length})`} href={`/projects/${project.id}/actions`}>
          {lateActions.slice(0, 5).map((a) => (
            <li key={a.id} className="flex justify-between">
              <span>{a.title}</span>
              <Pill text={a.status} tone={statusTone(a.status)} />
            </li>
          ))}
        </QuickList>
        <QuickList title={`Risques ouverts (${openRisks.length})`} href={`/projects/${project.id}/risks`}>
          {openRisks.slice(0, 5).map((r) => (
            <li key={r.id} className="flex justify-between">
              <span>{r.description}</span>
              <Pill text={r.criticite} tone={statusTone(r.criticite)} />
            </li>
          ))}
        </QuickList>
        <QuickList title={`Décisions en attente (${pendingDecisions.length})`} href={`/projects/${project.id}/decisions`}>
          {pendingDecisions.slice(0, 5).map((d) => (
            <li key={d.id} className="flex justify-between">
              <span>{d.subject}</span>
              <Pill text={d.status} tone={statusTone(d.status)} />
            </li>
          ))}
        </QuickList>
        <QuickList title={`Interfaces bloquantes (${blockingInterfaces.length})`} href={`/projects/${project.id}/interfaces`}>
          {blockingInterfaces.slice(0, 5).map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>{i.name}</span>
              <Pill text={i.status} tone="bad" />
            </li>
          ))}
        </QuickList>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Mémoire récente du projet</div>
          <Link href={`/projects/${project.id}/timeline`} className="text-sm text-teal-700 hover:underline">
            Voir toute la timeline →
          </Link>
        </div>
        <ul className="text-sm space-y-2">
          {project.timelineEvents.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="text-ink/40 w-24 shrink-0">{new Date(e.date).toLocaleDateString("fr-FR")}</span>
              <span>{e.description}</span>
            </li>
          ))}
          {project.timelineEvents.length === 0 && <li className="text-ink/50">Aucun événement pour le moment.</li>}
        </ul>
      </div>
    </div>
  );
}

function QuickList({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">{title}</div>
        <Link href={href} className="text-xs text-teal-700 hover:underline">
          Gérer →
        </Link>
      </div>
      <ul className="text-sm space-y-1.5">
        {children}
        {!children || (Array.isArray(children) && children.length === 0) ? null : null}
      </ul>
    </div>
  );
}
