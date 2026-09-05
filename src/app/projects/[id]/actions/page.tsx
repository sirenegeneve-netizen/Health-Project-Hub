import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActionForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["a_faire", "À faire"],
  ["en_cours", "En cours"],
  ["en_attente", "En attente"],
  ["termine", "Terminé"],
  ["abandonne", "Abandonné"],
].map(([value, label]) => ({ value, label }));

export default async function ActionsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const actions = await prisma.action.findMany({ where: { projectId: params.id }, orderBy: [{ status: "asc" }, { echeance: "asc" }] });
  const now = new Date();

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-teal-700 mb-4">Actions</h1>
      <ActionForm projectId={params.id} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Intitulé</th>
              <th>Responsable</th>
              <th>Échéance</th>
              <th>Priorité</th>
              <th>Origine</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => {
              const late = a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status);
              return (
                <tr key={a.id} className={late ? "bg-bad/5" : ""}>
                  <td className="pl-4">
                    {a.title}
                    {a.postponedCount > 0 && <span className="text-xs text-warn ml-2">reportée ×{a.postponedCount}</span>}
                    {!a.responsable && <div className="text-xs text-bad">responsable non renseigné</div>}
                  </td>
                  <td>{a.responsable || "—"}</td>
                  <td className={late ? "text-bad font-medium" : ""}>
                    {a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : <span className="text-bad">non renseignée</span>}
                  </td>
                  <td>
                    <Pill text={a.priority} tone={a.priority === "critique" ? "bad" : "neutral"} />
                  </td>
                  <td className="text-ink/50 text-xs">{a.origine}</td>
                  <td>
                    <InlineSelect endpoint={`/api/actions/${a.id}`} field="status" value={a.status} options={STATUS_OPTIONS} />
                  </td>
                </tr>
              );
            })}
            {actions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink/50">
                  Aucune action pour ce projet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
