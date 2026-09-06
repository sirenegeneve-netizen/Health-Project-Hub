import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { TrainingForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

const AUTONOMY_LABELS = [
  "0 — Non formé",
  "1 — Formé mais accompagné",
  "2 — Autonome sur les opérations courantes",
  "3 — Autonome et capable d'aider ses collègues",
  "4 — Référent / expert",
];

export default async function TrainingPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { establishment: true } } },
  });
  if (!project) notFound();
  const trainings = await prisma.trainingRecord.findMany({ where: { projectId: params.id }, include: { establishment: true }, orderBy: { createdAt: "desc" } });

  const totalUsers = trainings.reduce((s, t) => s + t.nbUsers, 0);
  const totalFormed = trainings.reduce((s, t) => s + t.nbFormes, 0);
  const totalAutonomous = trainings.reduce((s, t) => s + (t.autonomyLevel >= 2 ? t.nbFormes : 0), 0);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Accompagnement — Formation & autonomie</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="label">Utilisateurs concernés</div>
          <div className="font-display text-2xl">{totalUsers}</div>
        </div>
        <div className="card">
          <div className="label">Formés</div>
          <div className="font-display text-2xl">{totalUsers ? Math.round((totalFormed / totalUsers) * 100) : 0}%</div>
        </div>
        <div className="card">
          <div className="label">Autonomes (niveau ≥ 2)</div>
          <div className="font-display text-2xl">{totalUsers ? Math.round((totalAutonomous / totalUsers) * 100) : 0}%</div>
          <div className="text-xs text-ink/50 mt-1">Formation réalisée ≠ autonomie acquise.</div>
        </div>
      </div>

      <TrainingForm projectId={params.id} establishments={project.establishments.map((e) => e.establishment)} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Établissement</th>
              <th>Profil / métier</th>
              <th>Utilisateurs</th>
              <th>Formés</th>
              <th>Niveau d'autonomie</th>
            </tr>
          </thead>
          <tbody>
            {trainings.map((t) => (
              <tr key={t.id}>
                <td className="pl-4">{t.establishment?.name || "—"}</td>
                <td>{t.profil || t.metier || "—"}</td>
                <td>{t.nbUsers}</td>
                <td>{t.nbFormes}</td>
                <td>{AUTONOMY_LABELS[t.autonomyLevel]}</td>
              </tr>
            ))}
            {trainings.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-ink/50">
                  Aucun suivi de formation enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
