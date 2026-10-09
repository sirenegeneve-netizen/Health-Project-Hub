import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { Pill } from "@/components/Pill";
import {
  StrategicPlanForm,
  StrategicGoalForm,
  StrategicGoalCycleForm,
  QualityRequirementForm,
  AuditFindingForm,
  FINDING_TYPES as FINDING_TYPE_LABELS,
} from "@/components/GovernanceForms";
import { ActionForm } from "@/components/EntityForms";
import { ActionPlanSection } from "@/components/ActionPlanSection";
import { CycleTargetCell, DiffuseButton, InheritedPill, ResyncButton } from "@/components/ObjectifsDiffusion";
import { diffusionProgress } from "@/lib/diffusion";

export const dynamic = "force-dynamic";

export default async function EstablishmentObjectifsPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!establishment) notFound();

  const ownerType = "etablissement" as const;
  const [plans, goals, cycles, requirements, findings, actors, planActions] = await Promise.all([
    prisma.strategicPlan.findMany({ where: { ownerType, ownerId: params.id }, orderBy: { startDate: "desc" } }),
    prisma.strategicGoal.findMany({ where: { ownerType, ownerId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.strategicGoalCycle.findMany({
      where: { strategicGoal: { ownerType, ownerId: params.id } },
      include: {
        strategicGoal: true,
        strategicPlan: true,
        contributions: { include: { initiative: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.qualityRequirement.findMany({
      where: { ownerType, ownerId: params.id },
      include: { coverages: { include: { initiative: { select: { id: true, name: true } } } } },
      orderBy: [{ referentiel: "asc" }, { createdAt: "asc" }],
    }),
    prisma.auditFinding.findMany({
      where: { ownerType, ownerId: params.id },
      include: { qualityRequirement: true, actions: true },
      orderBy: { dateConstat: "desc" },
    }),
    prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
    prisma.action.findMany({
      where: { ownerType, ownerId: params.id },
      include: { strategicGoalCycle: { include: { strategicGoal: true, strategicPlan: true } } },
      orderBy: [{ echeance: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const applicableRequirements = requirements.filter((r) => r.applicable);
  const couvertes = applicableRequirements.filter((r) => r.coverages.some((c) => c.niveau === "totale")).length;
  const partielles = applicableRequirements.filter(
    (r) => !r.coverages.some((c) => c.niveau === "totale") && r.coverages.some((c) => c.niveau === "partielle")
  ).length;
  const nonCouvertes = applicableRequirements.length - couvertes - partielles;
  const tauxCouverture = applicableRequirements.length > 0 ? Math.round((couvertes / applicableRequirements.length) * 100) : null;

  const cyclesByPlan = new Map<string, typeof cycles>();
  for (const cy of cycles) {
    const list = cyclesByPlan.get(cy.strategicPlanId) || [];
    list.push(cy);
    cyclesByPlan.set(cy.strategicPlanId, list);
  }

  const planObjectives = cycles.map((cy) => ({
    id: cy.id,
    label: `${cy.strategicGoal.libelle}${cy.libelle ? " — " + cy.libelle : ""} · ${cy.strategicPlan.libelle}`,
  }));
  const planActionRows = planActions.map((a) => ({
    id: a.id,
    title: a.title,
    livrable: a.livrable,
    priority: a.priority,
    status: a.status,
    responsable: a.responsable,
    echeance: a.echeance,
    initiativeId: a.initiativeId,
    cycle: a.strategicGoalCycle
      ? {
          id: a.strategicGoalCycle.id,
          goalLabel: a.strategicGoalCycle.strategicGoal.libelle,
          planLabel: a.strategicGoalCycle.strategicPlan.libelle,
          cible: a.strategicGoalCycle.cible,
          indicateurs: a.strategicGoalCycle.indicateurs,
        }
      : null,
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/establishments/${establishment.id}/objectifs/nouveau`} className="btn">
          + Nouvel objectif stratégique
        </Link>
      </div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <p className="text-sm text-muted mb-6">
        Objectifs stratégiques de l'établissement, versionnés par cycle de plan. Une initiative sans objectif rattaché apparaît comme orpheline sur
        sa page Cadrage ; un objectif sans initiative apparaît sans contribution ci-dessous. Les plans et objectifs « hérités du groupe » ont un
        libellé verrouillé : l'établissement saisit sa propre cible, ses indicateurs et son plan d'action.
      </p>

      <section className="mb-8">
        <h2 className="font-display text-lg text-ink mb-3">Plans stratégiques</h2>
        <StrategicPlanForm ownerType={ownerType} ownerId={establishment.id} />
        {plans.length === 0 ? (
          <div className="card text-center text-muted py-8">Aucun plan stratégique déclaré.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <span key={p.id} className="card px-3 py-2 text-sm">
                <span className="font-medium text-ink">{p.libelle}</span>{" "}
                <span className="text-muted">
                  ({p.startDate.toLocaleDateString("fr-FR")} – {p.endDate.toLocaleDateString("fr-FR")})
                </span>{" "}
                <Pill text={p.statut} tone={p.statut === "actif" ? "ok" : "neutral"} />{" "}
                {p.parentPlanId && <InheritedPill />}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg text-ink mb-3">Objectifs stratégiques</h2>
        <StrategicGoalForm ownerType={ownerType} ownerId={establishment.id} />
        {goals.length === 0 ? (
          <div className="card text-center text-muted py-8">Aucun objectif stratégique déclaré.</div>
        ) : (
          <ul className="space-y-1">
            {goals.map((g) => (
              <li key={g.id} className="text-sm">
                <span className="font-medium text-ink">{g.libelle}</span>
                {g.description && <span className="text-muted"> — {g.description}</span>}{" "}
                {g.parentGoalId && <InheritedPill />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg text-ink mb-3">Déclinaison par plan</h2>
        <StrategicGoalCycleForm
          goals={goals.map((g) => ({ id: g.id, libelle: g.libelle }))}
          plans={plans.map((p) => ({ id: p.id, libelle: p.libelle }))}
        />
        {plans.length === 0 ? (
          <p className="text-sm text-muted">Créez d'abord un plan et un objectif ci-dessus.</p>
        ) : (
          plans.map((p) => {
            const planCycles = cyclesByPlan.get(p.id) || [];
            return (
              <div key={p.id} className="mb-6">
                <h3 className="text-sm font-semibold text-ink mb-2">{p.libelle}</h3>
                {planCycles.length === 0 ? (
                  <div className="card text-center text-muted py-6 text-sm">Aucun objectif décliné dans ce plan.</div>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    <table className="table-hp">
                      <thead>
                        <tr className="bg-teal-50/50">
                          <th className="pl-4">Objectif</th>
                          <th>Statut</th>
                          <th>Cible & indicateurs</th>
                          <th>Initiatives contributrices</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planCycles.map((cy) => (
                          <tr key={cy.id}>
                            <td className="pl-4 text-sm">
                              <Link href={`/establishments/${establishment.id}/objectifs/${cy.id}`} className="text-blue hover:underline">{cy.strategicGoal.libelle}</Link>{cy.strategicGoal.parentGoalId && <> <InheritedPill /></>}
                              {cy.libelle && <span className="text-muted"> — {cy.libelle}</span>}
                            </td>
                            <td>
                              <Pill text={cy.statut} tone={cy.statut === "actif" ? "ok" : "neutral"} />
                            </td>
                            <td>
                              <CycleTargetCell cycleId={cy.id} cible={cy.cible} indicateurs={cy.indicateurs} />
                            </td>
                            <td className="text-sm">
                              {cy.contributions.length === 0 ? (
                                <span className="text-muted">Aucune — objectif non pris en charge</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {cy.contributions.map((c) => (
                                    <Link key={c.id} href={`/initiatives/${c.initiative.id}/cadrage`} className="text-blue hover:underline">
                                      {c.initiative.name}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <ActionPlanSection ownerType={ownerType} ownerId={establishment.id} actions={planActionRows} objectives={planObjectives} actors={actors} />

      <section className="mt-10">
        <h2 className="font-display text-lg text-ink mb-3">Exigences qualité & conformité</h2>
        {tauxCouverture !== null && (
          <div className="card px-4 py-3 mb-4 text-sm">
            <span className="font-medium text-ink">{tauxCouverture}% des exigences applicables sont couvertes</span>{" "}
            <span className="text-muted">
              ({couvertes} couvertes, {partielles} partiellement, {nonCouvertes} non couvertes — {applicableRequirements.length} exigences applicables)
            </span>
          </div>
        )}
        <QualityRequirementForm ownerType={ownerType} ownerId={establishment.id} />
        {requirements.length === 0 ? (
          <div className="card text-center text-muted py-8">Aucune exigence qualité déclarée.</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Référentiel</th>
                  <th>Exigence</th>
                  <th>Couverture</th>
                  <th>Initiatives</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => {
                  const totale = r.coverages.some((c) => c.niveau === "totale");
                  const partielle = !totale && r.coverages.some((c) => c.niveau === "partielle");
                  return (
                    <tr key={r.id} className={!r.applicable ? "opacity-50" : ""}>
                      <td className="pl-4 text-sm text-muted whitespace-nowrap">
                        {r.referentiel}
                        {r.code && <span> {r.code}</span>}
                      </td>
                      <td className="text-sm">
                        {r.libelle}
                        {!r.applicable && <span className="text-muted"> (non applicable)</span>}
                      </td>
                      <td>
                        {!r.applicable ? (
                          <Pill text="n/a" tone="neutral" />
                        ) : totale ? (
                          <Pill text="couverte" tone="ok" />
                        ) : partielle ? (
                          <Pill text="partielle" tone="warn" />
                        ) : (
                          <Pill text="non couverte" tone="bad" />
                        )}
                      </td>
                      <td className="text-sm">
                        {r.coverages.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.coverages.map((c) => (
                              <Link key={c.id} href={`/initiatives/${c.initiative.id}/cadrage`} className="text-blue hover:underline">
                                {c.initiative.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <h2 className="font-display text-lg text-ink mb-3">Constats d'audit</h2>
        <p className="text-sm text-muted mb-3">
          Écarts, observations et points forts constatés, optionnellement liés à une exigence. Un écart ouvert sans action correctrice reste visible
          comme non traité.
        </p>
        <AuditFindingForm
          ownerType={ownerType}
          ownerId={establishment.id}
          requirements={applicableRequirements.map((r) => ({ id: r.id, label: `${r.referentiel}${r.code ? " " + r.code : ""} — ${r.libelle}` }))}
        />
        {findings.length === 0 ? (
          <div className="card text-center text-muted py-8">Aucun constat d'audit déclaré.</div>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <div key={f.id} className="card">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <Pill
                      text={FINDING_TYPE_LABELS[f.type] || f.type}
                      tone={f.type === "ecart" ? "bad" : f.type === "point_fort" ? "ok" : "neutral"}
                    />
                    <span className="font-medium text-ink text-sm">{f.libelle}</span>
                  </div>
                  <Pill text={f.statut.replace(/_/g, " ")} tone={f.statut === "cloture" ? "ok" : f.statut === "en_traitement" ? "warn" : "bad"} />
                </div>
                {f.qualityRequirement && (
                  <p className="text-xs text-muted mb-2">
                    Exigence : {f.qualityRequirement.referentiel}
                    {f.qualityRequirement.code ? " " + f.qualityRequirement.code : ""} — {f.qualityRequirement.libelle}
                  </p>
                )}
                {f.description && <p className="text-sm text-ink/70 mb-2">{f.description}</p>}

                <div className="mt-2">
                  <p className="text-xs font-medium text-muted mb-1">Actions correctrices</p>
                  {f.actions.length === 0 ? (
                    <p className="text-xs text-muted mb-2">Aucune — constat non traité.</p>
                  ) : (
                    <ul className="text-sm mb-2">
                      {f.actions.map((a) => (
                        <li key={a.id}>
                          {a.title} — <span className="text-muted">{a.status.replace(/_/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionForm
                    initiativeId=""
                    ownerType={ownerType}
                    ownerId={establishment.id}
                    auditFindingId={f.id}
                    actors={actors}
                    label="+ Action correctrice"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
