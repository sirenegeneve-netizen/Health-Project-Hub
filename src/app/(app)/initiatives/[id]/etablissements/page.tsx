import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { InitiativeTabs } from "@/components/InitiativeTabs";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";
import { STAGES } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

const PHASE_OPTIONS = [{ value: "", label: "— (aligné sur le projet)" }, ...STAGES.map((s) => ({ value: s.key, label: s.label }))];

// Vue comparative multi-établissements (§27 du prompt de refonte) : une ligne
// par site, pour répondre à « où en est-on établissement par établissement ? ».
// L'avancement, les risques et la formation sont calculés uniquement à partir
// des actions/risques/populations explicitement rattachées à ce site — celles
// non affectées à un établissement précis sont signalées sous le tableau
// plutôt qu'agrégées dans une moyenne trompeuse.
export default async function EstablishmentsComparisonPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { establishment: true } } },
  });
  if (!initiative) notFound();

  const [risks, trainings, actions] = await Promise.all([
    prisma.risk.findMany({ where: { initiativeId: params.id } }),
    prisma.trainingRecord.findMany({ where: { initiativeId: params.id } }),
    prisma.action.findMany({ where: { initiativeId: params.id } }),
  ]);

  const rows = initiative.establishments.map((pe) => {
    const siteRisks = risks.filter((r) => r.establishmentId === pe.establishmentId);
    const openRisks = siteRisks.filter((r) => !["maitrise", "cloture"].includes(r.status));
    const criticalRisks = openRisks.filter((r) => ["forte", "critique"].includes(r.criticite));

    const siteActions = actions.filter((a) => a.establishmentId === pe.establishmentId);
    const progress = siteActions.length > 0 ? Math.round((siteActions.filter((a) => a.status === "termine").length / siteActions.length) * 100) : null;

    const siteTrainings = trainings.filter((t) => t.establishmentId === pe.establishmentId);
    const totalUsers = siteTrainings.reduce((s, t) => s + t.nbUsers, 0);
    const totalFormed = siteTrainings.reduce((s, t) => s + t.nbFormes, 0);
    const totalAutonomous = siteTrainings.reduce((s, t) => s + (t.autonomyLevel >= 2 ? t.nbFormes : 0), 0);
    const formationRate = totalUsers > 0 ? Math.round((totalFormed / totalUsers) * 100) : null;
    const autonomyRate = totalUsers > 0 ? Math.round((totalAutonomous / totalUsers) * 100) : null;

    return {
      id: pe.id,
      name: pe.establishment.name,
      phase: pe.phase || "",
      phaseInherited: !pe.phase,
      progress,
      openRisks: openRisks.length,
      criticalRisks: criticalRisks.length,
      formationRate,
      autonomyRate,
    };
  });

  const unassignedRisks = risks.filter((r) => !r.establishmentId && !["maitrise", "cloture"].includes(r.status)).length;
  const unassignedTrainings = trainings.filter((t) => !t.establishmentId).length;
  const unassignedActions = actions.filter((a) => !a.establishmentId).length;

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-1">Établissements</h1>
      <p className="text-sm text-muted mb-6">Comparer rapidement l'avancement des différents sites du projet.</p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun établissement rattaché à ce projet pour l'instant (à ajouter depuis l'onglet Cadrage).</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Établissement</th>
                <th>Phase</th>
                <th>Avancement</th>
                <th>Risques ouverts</th>
                <th>Formation</th>
                <th>Autonomie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="pl-4 font-medium text-ink">{r.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <InlineSelect endpoint={`/api/initiative-establishments/${r.id}`} field="phase" value={r.phase} options={PHASE_OPTIONS} />
                      {r.phaseInherited && <span className="text-xs text-ink/40">(projet)</span>}
                    </div>
                  </td>
                  <td>{r.progress === null ? <span className="text-ink/40">—</span> : `${r.progress}%`}</td>
                  <td>
                    {r.openRisks > 0 ? (
                      <Pill text={`${r.openRisks}${r.criticalRisks > 0 ? ` dont ${r.criticalRisks} critique(s)` : ""}`} tone={r.criticalRisks > 0 ? "bad" : "warn"} />
                    ) : (
                      <Pill text="0" tone="ok" />
                    )}
                  </td>
                  <td>{r.formationRate === null ? <span className="text-ink/40">—</span> : `${r.formationRate}%`}</td>
                  <td>{r.autonomyRate === null ? <span className="text-ink/40">—</span> : `${r.autonomyRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(unassignedRisks > 0 || unassignedTrainings > 0 || unassignedActions > 0) && (
        <p className="text-xs text-ink/45 mt-4">
          {[
            unassignedActions > 0 && `${unassignedActions} action(s)`,
            unassignedRisks > 0 && `${unassignedRisks} risque(s) ouvert(s)`,
            unassignedTrainings > 0 && `${unassignedTrainings} population(s) de formation`,
          ]
            .filter(Boolean)
            .join(" et ")}{" "}
          ne sont rattachés à aucun établissement précis (avancement/formation/risques de la vue globale du projet).
        </p>
      )}
    </div>
  );
}
