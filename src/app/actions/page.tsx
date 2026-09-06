import Link from "next/link";
import { prisma } from "@/lib/db";
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

export default async function GlobalActionsPage() {
  const actions = await prisma.action.findMany({
    include: { project: true },
    orderBy: [{ status: "asc" }, { echeance: "asc" }],
  });
  const now = new Date();

  if (actions.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Actions</h1>
        <div className="card text-center text-ink/50 py-14">
          Aucune action pour l'instant. Ouvrez un projet pour en créer.
        </div>
      </div>
    );
  }

  const late = actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-2xl text-ink">Actions</h1>
        {late.length > 0 && <span className="text-sm text-bad">{late.length} en retard</span>}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Tâche</th>
              <th>Projet</th>
              <th>Responsable</th>
              <th>Échéance</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => {
              const isLate = a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status);
              return (
                <tr key={a.id} className={isLate ? "bg-bad/5" : ""}>
                  <td className="pl-4">{a.title}</td>
                  <td>
                    <Link href={`/projects/${a.projectId}`} className="text-blue hover:underline">
                      {a.project.name}
                    </Link>
                  </td>
                  <td>{a.responsable || "—"}</td>
                  <td className={isLate ? "text-bad font-medium" : ""}>
                    {a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td>
                    <InlineSelect endpoint={`/api/actions/${a.id}`} field="status" value={a.status} options={STATUS_OPTIONS} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
