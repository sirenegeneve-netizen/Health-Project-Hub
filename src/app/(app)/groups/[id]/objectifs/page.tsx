import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GroupTabs } from "@/components/GroupTabs";
import { Pill } from "@/components/Pill";
import { StrategicPlanForm, StrategicGoalForm, StrategicGoalCycleForm, QualityRequirementForm } from "@/components/GovernanceForms";

export const dynamic = "force-dynamic";

export default async function GroupObjectifsPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!group) notFound();

  const ownerType = "groupe" as const;
  const [plans, goals, cycles, requirements] = await Promise.all([
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

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <p className="text-sm text-muted mb-6">
        Objectifs stratégiques du groupe, versionnés par cycle de plan. Une initiative sans objectif rattaché apparaît comme orpheline sur sa page
        Cadrage ; un objectif sans initiative apparaît sans contribution ci-dessous.
      </p>

      <section className="mb-8">
        <h2 className="font-display text-lg text-ink mb-3">Plans stratégiques</h2>
        <StrategicPlanForm ownerType={ownerType} ownerId={group.id} />
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
                <Pill text={p.statut} tone={p.statut === "actif" ? "ok" : "neutral"} />
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg text-ink mb-3">Objectifs stratégiques</h2>
        <StrategicGoalForm ownerType={ownerType} ownerId={group.id} />
        {goals.length === 0 ? (
          <div className="card text-center text-muted py-8">Aucun objectif stratégique déclaré.</div>
        ) : (
          <ul className="space-y-1">
            {goals.map((g) => (
              <li key={g.id} className="text-sm">
                <span className="font-medium text-ink">{g.libelle}</span>
                {g.description && <span className="text-muted"> — {g.description}</span>}
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
                          <th>Cible</th>
                          <th>Initiatives contributrices</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planCycles.map((cy) => (
                          <tr key={cy.id}>
                            <td className="pl-4 text-sm">
                              {cy.strategicGoal.libelle}
                              {cy.libelle && <span className="text-muted"> — {cy.libelle}</span>}
                            </td>
                            <td>
                              <Pill text={cy.statut} tone={cy.statut === "actif" ? "ok" : "neutral"} />
                            </td>
                            <td className="text-sm text-muted">{cy.cible || "—"}</td>
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
        <QualityRequirementForm ownerType={ownerType} ownerId={group.id} />
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
    </div>
  );
}
