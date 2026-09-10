import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";
import { STAGES } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

const PHASE_OPTIONS = [{ value: "", label: "— (aligné sur le projet)" }, ...STAGES.map((s) => ({ value: s.key, label: s.label }))];

// Vue comparative multi-établissements (§27 du prompt de refonte) : une ligne
// par site, pour répondre à « où en est-on établissement par établissement ? ».
// Seuls les risques et la formation sont déjà rattachables à un établissement
// dans le modèle de données actuel — l'avancement des actions ne l'est pas
// encore, donc cette colonne n'est volontairement pas affichée plutôt que
// d'inventer un chiffre.
export default async function EstablishmentsComparisonPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { establishment: true } } },
  });
  if (!project) notFound();

  const [risks, trainings] = await Promise.all([
    prisma.risk.findMany({ where: { projectId: params.id } }),
    prisma.trainingRecord.findMany({ where: { projectId: params.id } }),
  ]);

  const rows = project.establishments.map((pe) => {
    const siteRisks = risks.filter((r) => r.establishmentId === pe.establishmentId);
    const openRisks = siteRisks.filter((r) => !["maitrise", "cloture"].includes(r.status));
    const criticalRisks = openRisks.filter((r) => ["forte", "critique"].includes(r.criticite));

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
      openRisks: openRisks.length,
      criticalRisks: criticalRisks.length,
      formationRate,
      autonomyRate,
    };
  });

  const unassignedRisks = risks.filter((r) => !r.establishmentId && !["maitrise", "cloture"].includes(r.status)).length;
  const unassignedTrainings = trainings.filter((t) => !t.establishmentId).length;

  return (
    <div>
      <ProjectTabs projectId={params.id} />
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
                      <InlineSelect endpoint={`/api/project-establishments/${r.id}`} field="phase" value={r.phase} options={PHASE_OPTIONS} />
                      {r.phaseInherited && <span className="text-xs text-ink/40">(projet)</span>}
                    </div>
                  </td>
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

      {(unassignedRisks > 0 || unassignedTrainings > 0) && (
        <p className="text-xs text-ink/45 mt-4">
          {[unassignedRisks > 0 && `${unassignedRisks} risque(s) ouvert(s)`, unassignedTrainings > 0 && `${unassignedTrainings} population(s) de formation`]
            .filter(Boolean)
            .join(" et ")}{" "}
          ne sont rattachés à aucun établissement précis.
        </p>
      )}
      <p className="text-xs text-ink/45 mt-2">L'avancement des actions n'est pas encore réparti par établissement, cette colonne n'est donc pas affichée.</p>
    </div>
  );
}
