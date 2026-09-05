import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActionForm, RiskForm, DecisionForm } from "@/components/EntityForms";
import { MeetingNotes } from "@/components/MeetingNotes";
import { Pill } from "@/components/Pill";
import { computeHealthScore } from "@/lib/healthScore";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({ params }: { params: { id: string; meetingId: string } }) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    include: { actions: true, risks: true, decisions: true, project: true },
  });
  if (!meeting || meeting.projectId !== params.id) notFound();

  const previousMeeting = await prisma.meeting.findFirst({
    where: { projectId: params.id, date: { lt: meeting.date } },
    orderBy: { date: "desc" },
  });

  const since = previousMeeting?.date ?? new Date(0);

  const [allActions, allRisks, pendingDecisions, vigilancePoints, eventsSince, score] = await Promise.all([
    prisma.action.findMany({ where: { projectId: params.id } }),
    prisma.risk.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.decision.findMany({ where: { projectId: params.id, status: { not: "decision_prise" } } }),
    prisma.vigilancePoint.findMany({ where: { projectId: params.id, status: "a_surveiller" } }),
    prisma.timelineEvent.findMany({ where: { projectId: params.id, date: { gte: since, lt: meeting.date } }, orderBy: { date: "asc" } }),
    computeHealthScore(params.id),
  ]);

  const now = new Date();
  const lateActions = allActions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));
  const openActions = allActions.filter((a) => !["termine", "abandonne"].includes(a.status));
  const doneRecently = allActions.filter((a) => a.status === "termine" && a.updatedAt >= since);
  const openRisks = allRisks.filter((r) => !["maitrise", "cloture"].includes(r.status));

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-4">
        <div className="text-xs text-ink/50 capitalize">{meeting.type.replace(/_/g, " ")}</div>
        <h1 className="font-display text-2xl text-teal-700">{meeting.title}</h1>
        <div className="text-sm text-ink/60">{new Date(meeting.date).toLocaleString("fr-FR")} — {meeting.participants || "participants non renseignés"}</div>
      </div>

      <div className="card mb-6">
        <div className="font-medium mb-3">
          Synthèse {previousMeeting ? `depuis « ${previousMeeting.title} »` : "de préparation"}
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <SynthItem title={`Actions en retard (${lateActions.length})`}>
            {lateActions.map((a) => <li key={a.id}>{a.title} — {a.responsable || "sans responsable"}</li>)}
          </SynthItem>
          <SynthItem title={`Actions ouvertes (${openActions.length})`}>
            {openActions.slice(0, 8).map((a) => <li key={a.id}>{a.title}</li>)}
          </SynthItem>
          <SynthItem title={`Actions terminées depuis la dernière réunion (${doneRecently.length})`}>
            {doneRecently.map((a) => <li key={a.id}>{a.title}</li>)}
          </SynthItem>
          <SynthItem title={`Risques ouverts (${openRisks.length})`}>
            {openRisks.slice(0, 8).map((r) => <li key={r.id}>{r.description} <Pill text={r.criticite} tone="warn" /></li>)}
          </SynthItem>
          <SynthItem title={`Décisions en attente (${pendingDecisions.length})`}>
            {pendingDecisions.map((d) => <li key={d.id}>{d.subject}</li>)}
          </SynthItem>
          <SynthItem title={`Points de vigilance (${vigilancePoints.length})`}>
            {vigilancePoints.map((v) => <li key={v.id}>{v.description}</li>)}
          </SynthItem>
        </div>
        <div className="mt-4 pt-4 border-t border-teal-50 text-sm">
          <div className="font-medium mb-1">État du projet : {score.label}</div>
          <div className="text-ink/60">{score.reasons.join(" · ")}</div>
        </div>
        {eventsSince.length > 0 && (
          <div className="mt-4 pt-4 border-t border-teal-50">
            <div className="font-medium text-sm mb-2">Événements survenus depuis la dernière réunion</div>
            <ul className="text-sm space-y-1">
              {eventsSince.map((e) => (
                <li key={e.id} className="text-ink/70">
                  {new Date(e.date).toLocaleDateString("fr-FR")} — {e.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <MeetingNotes meetingId={meeting.id} initial={meeting.notes || ""} />
        </div>
        <div className="space-y-3">
          <div className="font-medium text-sm">Saisie rapide pendant la réunion</div>
          <ActionForm projectId={params.id} meetingId={meeting.id} label="+ Action" />
          <RiskForm projectId={params.id} meetingId={meeting.id} label="+ Risque" />
          <DecisionForm projectId={params.id} meetingId={meeting.id} label="+ Décision" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6 text-sm">
        <div className="card">
          <div className="font-medium mb-2">Décisions de cette réunion</div>
          <ul className="space-y-1">
            {meeting.decisions.map((d) => <li key={d.id}>{d.subject}</li>)}
            {meeting.decisions.length === 0 && <li className="text-ink/40">Aucune</li>}
          </ul>
        </div>
        <div className="card">
          <div className="font-medium mb-2">Actions de cette réunion</div>
          <ul className="space-y-1">
            {meeting.actions.map((a) => <li key={a.id}>{a.title}</li>)}
            {meeting.actions.length === 0 && <li className="text-ink/40">Aucune</li>}
          </ul>
        </div>
        <div className="card">
          <div className="font-medium mb-2">Risques de cette réunion</div>
          <ul className="space-y-1">
            {meeting.risks.map((r) => <li key={r.id}>{r.description}</li>)}
            {meeting.risks.length === 0 && <li className="text-ink/40">Aucun</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SynthItem({ title, children }: { title: string; children: React.ReactNode }) {
  const isEmpty = Array.isArray(children) && children.length === 0;
  return (
    <div>
      <div className="text-ink/60 mb-1">{title}</div>
      <ul className="list-disc pl-4 space-y-0.5">{isEmpty ? <li className="text-ink/30 list-none -ml-4">—</li> : children}</ul>
    </div>
  );
}
