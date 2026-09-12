import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { RequirementForm, GapForm, DeliverableForm, ChangeForm, DecisionForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";
import { computeConceptionReadiness } from "@/lib/readiness";
import { HealthBadge } from "@/components/HealthBadge";

export const dynamic = "force-dynamic";

const REQUIREMENT_STATUS = [
  ["a_analyser", "À analyser"],
  ["en_attente_arbitrage", "En attente d'arbitrage"],
  ["retenu", "Retenu"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

const GAP_STATUS = [
  ["identifie", "Identifié"],
  ["arbitre", "Arbitré"],
  ["resolu", "Résolu"],
].map(([value, label]) => ({ value, label }));

const DECISION_STATUS = [
  ["en_attente", "En attente"],
  ["arbitrage_necessaire", "Arbitrage nécessaire"],
  ["decision_prise", "Décision prise"],
].map(([value, label]) => ({ value, label }));

const DELIVERABLE_STATUS = [
  ["a_venir", "À venir"],
  ["en_cours", "En cours"],
  ["valide", "Validé"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function ConceptionPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: params.id } });
  if (!initiative) notFound();

  const [requirements, gaps, decisions, deliverables, changes, actors] = await Promise.all([
    prisma.requirement.findMany({ where: { initiativeId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.gap.findMany({ where: { initiativeId: params.id }, include: { requirement: true }, orderBy: { createdAt: "desc" } }),
    prisma.decision.findMany({ where: { initiativeId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.deliverable.findMany({ where: { initiativeId: params.id }, orderBy: { datePrevue: "asc" } }),
    prisma.changeRequest.findMany({ where: { initiativeId: params.id }, orderBy: { createdAt: "desc" } }),
    findInitiativeActors(params.id, { id: true, name: true }),
  ]);

  const openRequirements = requirements.filter((r) => ["a_analyser", "en_attente_arbitrage"].includes(r.statut)).length;
  const unresolvedGaps = gaps.filter((g) => g.statut !== "resolu").length;
  const pendingDecisions = decisions.filter((d) => d.status !== "decision_prise");
  const unvalidatedDeliverables = deliverables.filter((d) => d.status !== "valide").length;
  const changesWithoutImpact = changes.filter(
    (c) => c.decision === "accepte" && !c.impactFonctionnel && c.impactPlanningJours === null && c.impactJh === null
  ).length;

  const readiness = computeConceptionReadiness({
    openRequirements,
    unresolvedGaps,
    pendingDecisions: pendingDecisions.length,
    unvalidatedDeliverables,
    changesWithoutImpact,
  });

  const retainedRequirements = requirements.filter((r) => r.statut === "retenu");

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="font-display text-2xl text-ink">Conception & Préparation</h1>
          <p className="text-sm text-muted">La solution est-elle suffisamment conçue et validée pour entrer en réalisation ?</p>
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
          <SectionTitle>Besoins</SectionTitle>
          {requirements.length > 0 && (
            <span className="text-xs text-muted">{retainedRequirements.length}/{requirements.length} retenu(s)</span>
          )}
        </div>
        <RequirementForm initiativeId={params.id} />
        {requirements.length > 0 ? (
          <div className="space-y-2">
            {requirements.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{r.titre}</div>
                  <div className="text-xs text-muted">
                    {r.origine && r.origine.replace(/_/g, " ")} {r.priorite === "haute" && "· priorité haute"}
                  </div>
                </div>
                <InlineSelect endpoint={`/api/requirements/${r.id}`} field="statut" value={r.statut} options={REQUIREMENT_STATUS} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun besoin exprimé pour l'instant.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Écarts identifiés</SectionTitle>
        <GapForm initiativeId={params.id} />
        {gaps.length > 0 ? (
          <div className="space-y-2">
            {gaps.map((g) => (
              <div key={g.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="font-medium text-sm">{g.description}</div>
                  <InlineSelect endpoint={`/api/gaps/${g.id}`} field="statut" value={g.statut} options={GAP_STATUS} />
                </div>
                {g.optionsEnvisagees && <div className="text-sm text-body">Options : {g.optionsEnvisagees}</div>}
                {g.decisionRetenue && <div className="text-sm text-ok mt-1">Retenu : {g.decisionRetenue}</div>}
                {g.impact && <Pill text={`Impact : ${g.impact}`} tone="warn" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun écart identifié pour l'instant.</div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Décisions & arbitrages</SectionTitle>
          <Link href={`/initiatives/${params.id}/realisation`} className="text-sm text-blue hover:underline">
            Toutes les décisions →
          </Link>
        </div>
        <DecisionForm initiativeId={params.id} actors={actors} />
        {pendingDecisions.length > 0 ? (
          <div className="space-y-2">
            {pendingDecisions.map((d) => (
              <div key={d.id} className="card flex items-center justify-between gap-4">
                <div className="font-medium text-sm">{d.subject}</div>
                <InlineSelect endpoint={`/api/decisions/${d.id}`} field="status" value={d.status} options={DECISION_STATUS} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun arbitrage en attente.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Changements & impacts</SectionTitle>
        <ChangeForm initiativeId={params.id} />
        {changes.length > 0 ? (
          <div className="space-y-2">
            {changes.map((c) => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div className="font-medium text-sm">{c.titre}</div>
                  <Pill
                    text={c.decision}
                    tone={c.decision === "accepte" ? "ok" : c.decision === "rejete" ? "bad" : "neutral"}
                  />
                </div>
                {c.decision === "accepte" && !c.impactFonctionnel && c.impactPlanningJours === null && c.impactJh === null ? (
                  <div className="text-xs text-bad">Impact non évalué</div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {c.impactFonctionnel && <Pill text={`Fonctionnel : ${c.impactFonctionnel}`} />}
                    {c.impactPlanningJours !== null && <Pill text={`Planning : +${c.impactPlanningJours}j`} tone="warn" />}
                    {c.impactJh !== null && <Pill text={`JH : ${c.impactJh}`} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun changement enregistré.</div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>Livrables produits</SectionTitle>
        </div>
        <p className="text-xs text-muted mb-3">Le résultat de ce travail de conception — pas le point de départ de l'écran.</p>
        <DeliverableForm initiativeId={params.id} actors={actors} />
        {deliverables.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Livrable</th>
                  <th>Responsable</th>
                  <th>Version</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d) => (
                  <tr key={d.id}>
                    <td className="pl-4 font-medium">{d.name}</td>
                    <td>{d.responsable || "—"}</td>
                    <td>{d.version || "—"}</td>
                    <td>
                      <InlineSelect endpoint={`/api/deliverables/${d.id}`} field="status" value={d.status} options={DELIVERABLE_STATUS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun livrable produit pour l'instant.</div>
        )}
      </section>
    </div>
  );
}
