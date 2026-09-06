import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActionForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";
import { ActionsKanban } from "@/components/ActionsKanban";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["a_faire", "À faire"],
  ["en_cours", "En cours"],
  ["en_attente", "En attente"],
  ["termine", "Terminé"],
  ["abandonne", "Abandonné"],
].map(([value, label]) => ({ value, label }));

export default async function ActionsPage({ params, searchParams }: { params: { id: string }; searchParams: { vue?: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const actions = await prisma.action.findMany({ where: { projectId: params.id }, orderBy: [{ status: "asc" }, { echeance: "asc" }] });
  const now = new Date();
  const vue = searchParams.vue === "kanban" ? "kanban" : "liste";

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-ink">Actions</h1>
        <div className="flex gap-1 text-sm">
          <a href="?vue=liste" className={`px-3 py-1.5 rounded-lg ${vue === "liste" ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50"}`}>
            Liste
          </a>
          <a href="?vue=kanban" className={`px-3 py-1.5 rounded-lg ${vue === "kanban" ? "bg-primary text-white" : "text-ink/60 hover:bg-teal-50"}`}>
            Kanban
          </a>
        </div>
      </div>
      <ActionForm projectId={params.id} />

      {actions.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune action pour ce projet.</div>
      ) : vue === "kanban" ? (
        <ActionsKanban
          actions={actions.map((a) => ({
            id: a.id,
            title: a.title,
            responsable: a.responsable,
            echeance: a.echeance ? a.echeance.toISOString() : null,
            priority: a.priority,
            status: a.status,
          }))}
        />
      ) : (
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
