import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeProgress, computeBudgetSummary, formatEur } from "@/lib/metrics";
import { computeStages } from "@/lib/lifecycle";
import { getWorkflowStages } from "@/lib/workflowStages";
import { findSinglePointsOfFailure, computeActorWorkload } from "@/lib/resourceGovernance";
import { HealthBadge } from "@/components/HealthBadge";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Synthèse COPIL : assemble uniquement des données déjà calculées ailleurs dans
// l'outil (santé, budget, ressources…) — aucun chiffre n'est recalculé selon une
// logique différente de celle vue par l'utilisateur sur les autres écrans.
// §16 du cahier des charges : réduire le temps de préparation d'un comité de
// pilotage, pas produire un document à part avec ses propres chiffres.
export default async function CopilPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: {
      establishments: { include: { establishment: true } },
      actions: { include: { responsableActor: true } },
      risks: { include: { proprietaireActor: true } },
      decisions: true,
      interfaces: true,
      deliverables: true,
      budgetLines: true,
      baselines: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { date: "desc" }, take: 8 },
      actors: true,
      raciEntries: true,
    },
  });
  if (!initiative) notFound();

  const score = await computeHealthScore(initiative.id);
  const now = new Date();

  const progress = computeProgress(initiative.actions);
  const budget = computeBudgetSummary(initiative.budgetInitialEur, initiative.budgetReviseEur, initiative.budgetLines);
  const workflowStages = await getWorkflowStages(initiative.type);
  const stages = computeStages(initiative.phase, workflowStages);
  const currentStage = stages.find((s) => s.status === "current") || stages[0];

  const lateActions = initiative.actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));
  const openRisks = initiative.risks.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const criticalRisks = openRisks.filter((r) => ["forte", "critique"].includes(r.criticite));
  const pendingDecisions = initiative.decisions.filter((d) => d.status !== "decision_prise");

  const upcomingActions = initiative.actions
    .filter((a) => a.echeance && a.echeance >= now && !["termine", "abandonne"].includes(a.status))
    .sort((a, b) => a.echeance!.getTime() - b.echeance!.getTime())
    .slice(0, 6);
  const upcomingDeliverables = initiative.deliverables
    .filter((d) => d.datePrevue && d.datePrevue >= now && d.status !== "valide")
    .sort((a, b) => a.datePrevue!.getTime() - b.datePrevue!.getTime())
    .slice(0, 6);

  const lastBaseline = initiative.baselines[initiative.baselines.length - 1];
  const firstBaseline = initiative.baselines[0];
  const dependencies = findSinglePointsOfFailure(initiative.raciEntries, new Map(initiative.actors.map((a) => [a.id, a.name])));

  const actorsByLoad = initiative.actors
    .map((a) => ({
      name: a.name,
      workload: computeActorWorkload(
        a,
        { actions: initiative.actions, risks: initiative.risks, interfaces: initiative.interfaces, deliverables: initiative.deliverables },
        initiative.raciEntries
      ).totalOwned,
    }))
    .filter((a) => a.workload > 0)
    .sort((a, b) => b.workload - a.workload)
    .slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={`/initiatives/${initiative.id}`} className="text-sm text-blue hover:underline">
          ← Retour au projet
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-ink/40 font-medium">Synthèse COPIL — généré le {now.toLocaleDateString("fr-FR")}</div>
        <h1 className="font-display text-3xl text-ink mt-1">{initiative.name}</h1>
        <div className="text-sm text-ink/60 mt-1">
          {initiative.establishments.map((e) => e.establishment.name).join(", ") || "Établissement non renseigné"}
          {initiative.chefDeProjet ? ` · Chef de projet : ${initiative.chefDeProjet}` : ""}
        </div>
      </div>

      <Section n={1} title="État général">
        <div className="flex items-center gap-3 mb-2">
          <HealthBadge level={score.level} label={score.label} />
        </div>
        {score.reasons.length > 0 ? (
          <ul className="text-sm text-ink/70 list-disc pl-5 space-y-0.5">
            {score.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucun signal d'alerte détecté.</p>
        )}
      </Section>

      <Section n={2} title="Avancement">
        <p className="text-sm text-ink/70">
          Étape actuelle : <span className="font-medium text-ink">{currentStage.label}</span>
          {progress !== null && <> · {progress}% des actions terminées</>}
        </p>
      </Section>

      <Section n={3} title="Faits marquants récents">
        {initiative.timelineEvents.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {initiative.timelineEvents.map((e) => (
              <li key={e.id}>
                {new Date(e.date).toLocaleDateString("fr-FR")} — {e.description}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucun événement enregistré récemment.</p>
        )}
      </Section>

      <Section n={4} title={`Risques (${openRisks.length} ouvert${openRisks.length > 1 ? "s" : ""}${criticalRisks.length > 0 ? `, dont ${criticalRisks.length} critique(s)` : ""})`}>
        {openRisks.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {openRisks
              .sort((a, b) => (["forte", "critique"].includes(b.criticite) ? 1 : 0) - (["forte", "critique"].includes(a.criticite) ? 1 : 0))
              .slice(0, 6)
              .map((r) => (
                <li key={r.id}>
                  {r.description} <span className="text-xs text-ink/40">({r.criticite}{(r.proprietaireActor?.name || r.proprietaire) ? ` · ${r.proprietaireActor?.name || r.proprietaire}` : ""})</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucun risque ouvert.</p>
        )}
      </Section>

      <Section n={5} title={`Actions en retard (${lateActions.length})`}>
        {lateActions.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {lateActions.map((a) => (
              <li key={a.id}>
                {a.title} — {a.responsableActor?.name || a.responsable || "sans responsable"} <span className="text-xs text-bad">échéance {new Date(a.echeance!).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucun retard.</p>
        )}
      </Section>

      <Section n={6} title={`Décisions attendues (${pendingDecisions.length})`}>
        {pendingDecisions.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {pendingDecisions.map((d) => (
              <li key={d.id}>{d.subject}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucune décision en attente.</p>
        )}
      </Section>

      <Section n={7} title="Planning">
        <p className="text-sm text-ink/70">
          {initiative.targetDate ? (
            <>Date cible : <span className="font-medium text-ink">{new Date(initiative.targetDate).toLocaleDateString("fr-FR")}</span></>
          ) : (
            "Date cible non renseignée"
          )}
          {lastBaseline && firstBaseline && lastBaseline.id !== firstBaseline.id && (
            <> · Révisée depuis la baseline initiale ({new Date(firstBaseline.targetDate).toLocaleDateString("fr-FR")})</>
          )}
        </p>
        {upcomingDeliverables.length > 0 && (
          <ul className="text-sm text-ink/70 space-y-1 mt-2">
            {upcomingDeliverables.map((d) => (
              <li key={d.id}>
                ◆ {d.name} — {new Date(d.datePrevue!).toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={8} title="Budget">
        {budget ? (
          <p className="text-sm text-ink/70">
            {formatEur(budget.reel)} consommés sur {formatEur(budget.budget)} ({budget.consumptionRate}%)
          </p>
        ) : (
          <p className="text-sm text-ink/50">Budget non renseigné pour ce projet.</p>
        )}
      </Section>

      <Section n={9} title="Ressources">
        {actorsByLoad.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {actorsByLoad.map((a) => (
              <li key={a.name}>
                {a.name} — {a.workload} élément(s) porté(s)
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucune charge notable identifiée.</p>
        )}
        {dependencies.length > 0 && (
          <p className="text-sm text-bad mt-2">
            ⚠ {dependencies.length} activité(s) reposant sur une seule personne : {dependencies.map((d) => `${d.activite} (${d.actorName})`).join(", ")}
          </p>
        )}
      </Section>

      <Section n={10} title="Prochaines étapes">
        {upcomingActions.length > 0 ? (
          <ul className="text-sm text-ink/70 space-y-1">
            {upcomingActions.map((a) => (
              <li key={a.id}>
                {a.title} — {a.responsableActor?.name || a.responsable || "sans responsable"} <span className="text-xs text-ink/40">{new Date(a.echeance!).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">Aucune échéance à venir renseignée.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4 break-inside-avoid">
      <div className="font-medium text-sm mb-2 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0">{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
