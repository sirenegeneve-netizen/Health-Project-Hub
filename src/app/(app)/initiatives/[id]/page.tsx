import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary, computeProgress, formatEur } from "@/lib/metrics";
import { HealthBadge } from "@/components/HealthBadge";
import { InitiativeTabs } from "@/components/InitiativeTabs";
import { InitiativeEditForm } from "@/components/InitiativeEditForm";
import { InitiativeJourney } from "@/components/InitiativeJourney";
import { getLifecycleStages } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

export default async function InitiativeDashboard({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: {
      establishments: { include: { establishment: true } },
      actions: true,
      risks: true,
      decisions: true,
      interfaces: true,
      budgetLines: true,
      baselines: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { date: "desc" }, take: 6 },
    },
  });
  if (!initiative) notFound();

  const score = await computeHealthScore(initiative.id);
  const now = new Date();

  const progress = computeProgress(initiative.actions);
  const budget = computeBudgetSummary(initiative.budgetInitialEur, initiative.budgetReviseEur, initiative.budgetLines);

  const lateActions = initiative.actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));
  const openRisks = initiative.risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const criticalRisks = openRisks.filter((r) => ["forte", "critique"].includes(r.criticite));
  const pendingDecisions = initiative.decisions.filter((d) => d.status !== "decision_prise");
  const blockingInterfaces = initiative.interfaces.filter((i) => i.isBlocking || i.status === "bloquant");

  const upcoming = initiative.actions
    .filter((a) => a.echeance && a.echeance >= now && !["termine", "abandonne"].includes(a.status))
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
    .slice(0, 5);

  const alerts: { label: string; href: string; tone: "bad" | "warn" }[] = [];
  if (criticalRisks.length > 0) alerts.push({ label: `Risque critique ouvert (${criticalRisks.length})`, href: `/initiatives/${initiative.id}/risks`, tone: "bad" });
  if (blockingInterfaces.length > 0) alerts.push({ label: `Interface bloquante (${blockingInterfaces.length})`, href: `/initiatives/${initiative.id}/interfaces`, tone: "bad" });
  if (lateActions.length > 0) alerts.push({ label: `Retard sur ${lateActions.length} action(s)`, href: `/initiatives/${initiative.id}/actions`, tone: "warn" });
  if (pendingDecisions.length > 0) alerts.push({ label: `${pendingDecisions.length} décision(s) attendue(s)`, href: `/initiatives/${initiative.id}/decisions`, tone: "warn" });
  if (budget && budget.consumptionRate >= 90) alerts.push({ label: `Budget proche du seuil (${budget.consumptionRate}% consommé)`, href: `/initiatives/${initiative.id}/budget`, tone: "warn" });

  return (
    <div>
      <InitiativeTabs initiativeId={initiative.id} />

      <div className="flex items-start justify-between gap-6 flex-wrap mb-3">
        <div>
          <div className="text-xs text-ink/45">{initiative.reference}</div>
          <h1 className="font-display text-3xl text-ink">{initiative.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/initiatives/${initiative.id}/copil`} className="btn-secondary text-sm print:hidden">
            Générer le COPIL
          </Link>
          <HealthBadge level={score.level} label={score.label} />
        </div>
      </div>

      <div className="mb-6">
        <InitiativeJourney initiativeId={initiative.id} stages={getLifecycleStages(initiative.phase)} alerts={alerts} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/60 mb-8">
        <span>{initiative.status}</span>
        {progress !== null && <span>Avancement : {progress}%</span>}
        {initiative.targetDate && <span>Échéance : {new Date(initiative.targetDate).toLocaleDateString("fr-FR")}</span>}
        {initiative.chefDeProjet && <span>Responsable : {initiative.chefDeProjet}</span>}
      </div>

      {/* Synthèse — uniquement les indicateurs disponibles */}
      <div className="flex flex-wrap gap-8 mb-8 pb-8 border-b border-teal-100">
        {progress !== null && <Metric label="Avancement" value={`${progress}%`} />}
        {budget && <Metric label="Budget" value={`${budget.consumptionRate}%`} sub={formatEur(budget.reste) + " restants"} href={`/initiatives/${initiative.id}/budget`} />}
        {initiative.targetDate && <Metric label="Échéance" value={new Date(initiative.targetDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} href={`/initiatives/${initiative.id}/planning`} />}
        {openRisks.length > 0 && <Metric label="Risques ouverts" value={String(openRisks.length)} tone={criticalRisks.length > 0 ? "bad" : undefined} href={`/initiatives/${initiative.id}/risks`} />}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">Prochaines échéances</div>
            <Link href={`/initiatives/${initiative.id}/planning`} className="text-xs text-blue hover:underline">
              Planning →
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <ul className="space-y-2">
              {upcoming.map((a) => (
                <li key={a.id} className="flex justify-between text-sm">
                  <span>{a.title}</span>
                  <span className="text-ink/50">{new Date(a.echeance!).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">Aucune échéance à venir renseignée.</p>
          )}
          {pendingDecisions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-teal-50">
              <div className="text-sm text-ink/60 mb-1.5">{pendingDecisions.length} décision(s) en attente</div>
              <Link href={`/initiatives/${initiative.id}/decisions`} className="text-xs text-blue hover:underline">
                Voir les décisions →
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">Dernières activités</div>
            <Link href={`/initiatives/${initiative.id}/timeline`} className="text-xs text-blue hover:underline">
              Tout voir →
            </Link>
          </div>
          {initiative.timelineEvents.length > 0 ? (
            <ul className="space-y-2">
              {initiative.timelineEvents.map((e) => (
                <li key={e.id} className="text-sm flex gap-3">
                  <span className="text-ink/40 w-16 shrink-0">{new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                  <span className="text-ink/70">{e.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">Aucune activité pour le moment.</p>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-teal-100">
        <InitiativeEditForm
          initiative={{
            id: initiative.id,
            status: initiative.status,
            phase: initiative.phase,
            priority: initiative.priority,
            targetDate: initiative.targetDate ? initiative.targetDate.toISOString() : null,
            budgetJh: initiative.budgetJh,
            jhPlanifies: initiative.jhPlanifies,
            jhConsommes: initiative.jhConsommes,
            chefDeProjet: initiative.chefDeProjet,
            sponsor: initiative.sponsor,
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "bad"; href?: string }) {
  const content = (
    <div>
      <div className="label">{label}</div>
      <div className={`font-display text-2xl mt-0.5 ${tone === "bad" ? "text-bad" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-xs text-ink/45 mt-0.5">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="hover:opacity-70 transition-opacity">
      {content}
    </Link>
  ) : (
    content
  );
}
