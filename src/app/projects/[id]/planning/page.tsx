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

export default async function PlanningPage({ params, searchParams }: { params: { id: string }; searchParams: { vue?: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { baselines: { orderBy: { createdAt: "asc" } } } });
  if (!project) notFound();
  const actions = await prisma.action.findMany({ where: { projectId: params.id }, orderBy: { echeance: "asc" } });
  const dated = actions.filter((a) => a.echeance);
  const vue = searchParams.vue === "timeline" ? "timeline" : "liste";

  if (actions.length === 0 && project.baselines.length <= 1) {
    return (
      <div>
        <ProjectTabs projectId={params.id} />
        <h1 className="font-display text-2xl text-teal-700 mb-4">Planning</h1>
        <ActionForm projectId={params.id} label="+ Ajouter une tâche" />
        <div className="card text-center text-ink/50 py-10">
          Aucune tâche ni jalon planifié pour l'instant. Ajoutez des actions avec une échéance pour construire le planning.
        </div>
      </div>
    );
  }

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-teal-700">Planning</h1>
        <div className="flex gap-1 text-sm">
          <a href="?vue=liste" className={`px-3 py-1.5 rounded-full ${vue === "liste" ? "bg-teal-700 text-white" : "text-ink/60 hover:bg-teal-50"}`}>
            Liste
          </a>
          <a href="?vue=timeline" className={`px-3 py-1.5 rounded-full ${vue === "timeline" ? "bg-teal-700 text-white" : "text-ink/60 hover:bg-teal-50"}`}>
            Timeline
          </a>
        </div>
      </div>

      <ActionForm projectId={params.id} label="+ Ajouter une tâche" />

      {project.baselines.length > 1 && (
        <div className="card mb-6 text-sm">
          <div className="font-medium mb-2">Historique des révisions de planning</div>
          <ul className="space-y-1">
            {project.baselines.map((b) => (
              <li key={b.id} className="flex justify-between text-ink/70">
                <span>
                  {b.label} {b.reason && <span className="text-ink/40">— {b.reason}</span>}
                </span>
                <span>{new Date(b.targetDate).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vue === "liste" ? (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Tâche</th>
                <th>Responsable</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="pl-4">{a.title}</td>
                  <td>{a.responsable || "—"}</td>
                  <td>{a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—"}</td>
                  <td>
                    <InlineSelect endpoint={`/api/actions/${a.id}`} field="status" value={a.status} options={STATUS_OPTIONS} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : dated.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune tâche datée à afficher sur la timeline.</div>
      ) : (
        <div className="card">
          <div className="space-y-3">
            {dated.map((a) => (
              <div key={a.id} className="flex items-center gap-4 text-sm">
                <span className="w-24 shrink-0 text-ink/50">{new Date(a.echeance!).toLocaleDateString("fr-FR")}</span>
                <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                <span className="flex-1">{a.title}</span>
                <Pill text={a.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
