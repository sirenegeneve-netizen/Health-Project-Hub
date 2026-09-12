import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { StageCriteriaList } from "@/components/StageCriteriaList";
import { ensureStageCriteria } from "@/lib/stageCriteria";
import { computeCadrageReadiness } from "@/lib/readiness";
import { computeBudgetSummary } from "@/lib/metrics";
import { HealthBadge } from "@/components/HealthBadge";

export const dynamic = "force-dynamic";

function isKickoffMeeting(m: { type: string; title: string }) {
  return m.type === "kick_off" || /kick.?off/i.test(m.title);
}

// Étape Kick-off : avant / pendant / après (§6 du prompt de refonte). Le "avant"
// réutilise le même indicateur que l'étape Cadrage (une seule source de vérité,
// pas de double saisie) ; le "pendant" pointe vers la réunion de Kick-off dans
// le module Réunions ; le "après" est une checklist propre à cette étape.
export default async function KickoffPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: { budgetLines: true },
  });
  if (!initiative) notFound();

  await ensureStageCriteria(params.id, "kickoff", initiative.type);

  const [stakeholders, actors, meetings, criteria] = await Promise.all([
    prisma.stakeholder.findMany({ where: { initiativeId: params.id } }),
    findInitiativeActors(params.id),
    prisma.meeting.findMany({ where: { initiativeId: params.id }, include: { actions: true, decisions: true }, orderBy: { date: "desc" } }),
    prisma.stageCriterion.findMany({ where: { initiativeId: params.id, stageKey: "kickoff" }, orderBy: { order: "asc" } }),
  ]);

  const budget = computeBudgetSummary(initiative.budgetInitialEur, initiative.budgetReviseEur, initiative.budgetLines);
  const filled = (v: string | null) => !!v && v.trim().length > 0;
  const before = computeCadrageReadiness({
    hasObjectifs: filled(initiative.description) && filled(initiative.objectifs) && filled(initiative.perimetre),
    stakeholdersCount: stakeholders.length,
    actorsCount: actors.length,
    hasBudget: budget !== null,
    hasTargetDate: !!initiative.targetDate,
  });

  const kickoffMeetings = meetings.filter(isKickoffMeeting);
  const lastMeeting = kickoffMeetings[0];

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-1">Kick-off</h1>
      <p className="text-sm text-muted mb-6">Préparer, capturer et vérifier le lancement du projet.</p>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">Avant le Kick-off</div>
          <HealthBadge level={before.level} label={before.label} />
        </div>
        <p className="text-xs text-ink/50 mb-2">Même indicateur que l'onglet Cadrage — à compléter là-bas si des éléments manquent.</p>
        {before.reasons.length > 0 && (
          <ul className="text-sm text-body space-y-1">
            {before.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted">·</span>
                {r}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/initiatives/${params.id}/cadrage`} className="text-sm text-blue hover:underline mt-2 inline-block">
          Compléter le cadrage →
        </Link>
      </div>

      <div className="card mb-6">
        <div className="font-medium text-sm mb-2">Pendant le Kick-off</div>
        {lastMeeting ? (
          <div>
            <div className="text-sm text-body mb-1">
              Réunion du {new Date(lastMeeting.date).toLocaleDateString("fr-FR")} — {lastMeeting.title}
            </div>
            <div className="text-xs text-ink/50 mb-2">
              {lastMeeting.actions.length} action(s) créée(s) · {lastMeeting.decisions.length} décision(s) enregistrée(s)
            </div>
            <Link href={`/initiatives/${params.id}/meetings`} className="text-sm text-blue hover:underline">
              Voir la réunion →
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted mb-2">Aucune réunion de Kick-off enregistrée pour l'instant.</p>
            <Link href={`/initiatives/${params.id}/meetings`} className="text-sm text-blue hover:underline">
              Créer la réunion de Kick-off →
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-medium text-sm mb-1">Après le Kick-off</div>
        <p className="text-xs text-ink/50 mb-2">Cliquer sur un statut pour le faire évoluer.</p>
        <StageCriteriaList criteria={criteria} />
      </div>
    </div>
  );
}
