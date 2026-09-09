import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { StakeholderForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

const LEVELS = ["faible", "moyenne", "forte"];

export default async function StakeholdersPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const stakeholders = await prisma.stakeholder.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  const withMatrixData = stakeholders.filter((s) => s.influence && s.implication);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Parties prenantes</h1>
      <StakeholderForm projectId={params.id} />

      {stakeholders.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune partie prenante renseignée.</div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden mb-6">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Nom</th>
                  <th>Organisation</th>
                  <th>Rôle</th>
                  <th>Implication</th>
                  <th>Influence</th>
                </tr>
              </thead>
              <tbody>
                {stakeholders.map((s) => (
                  <tr key={s.id}>
                    <td className="pl-4 font-medium">{s.name}</td>
                    <td>{s.organisation || "—"}</td>
                    <td>{s.role || "—"}</td>
                    <td className="capitalize">{s.implication || "—"}</td>
                    <td className="capitalize">{s.influence || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {withMatrixData.length > 0 && (
            <div className="card">
              <div className="font-medium mb-3">Matrice influence / intérêt</div>
              <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1 text-sm">
                <div />
                {LEVELS.map((l) => (
                  <div key={l} className="text-center text-xs text-ink/50 pb-1 capitalize">
                    {l}
                  </div>
                ))}
                {LEVELS.slice()
                  .reverse()
                  .map((impl) => (
                    <div key={impl} className="contents">
                      <div className="text-xs text-ink/50 flex items-center capitalize pr-2">{impl}</div>
                      {LEVELS.map((infl) => {
                        const cell = withMatrixData.filter((s) => s.implication === impl && s.influence === infl);
                        return (
                          <div key={`${impl}-${infl}`} className="min-h-14 rounded border border-teal-100 bg-sage p-1.5">
                            {cell.map((s) => (
                              <div key={s.id} className="text-xs bg-white rounded px-1.5 py-1 mb-1 last:mb-0 truncate">
                                {s.name}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
              <div className="text-xs text-ink/40 mt-2">Implication (lignes) × Influence (colonnes)</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
