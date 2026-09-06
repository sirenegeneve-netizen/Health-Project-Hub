import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { Pill } from "@/components/Pill";
import { GoNoGoDecisionForm } from "@/components/GoNoGoDecisionForm";

export const dynamic = "force-dynamic";

export default async function GoLivePage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { interfaces: true, anomalies: true, trainings: true, decisions: true },
  });
  if (!project) notFound();

  const blockingInterfaces = project.interfaces.filter((i) => i.isBlocking || i.status === "bloquant");
  const unvalidatedInterfaces = project.interfaces.filter((i) => i.status !== "valide" && !(i.isBlocking || i.status === "bloquant"));
  const criticalAnomalies = project.anomalies.filter((a) => a.criticite === "critique" && !["corrigee", "validee"].includes(a.status));
  const totalUsers = project.trainings.reduce((s, t) => s + t.nbUsers, 0);
  const totalAutonomous = project.trainings.reduce((s, t) => s + (t.autonomyLevel >= 2 ? t.nbFormes : 0), 0);
  const autonomyRate = totalUsers > 0 ? totalAutonomous / totalUsers : null;

  const checklist = [
    { label: "Interfaces validées (aucune bloquante)", ok: blockingInterfaces.length === 0, detail: `${blockingInterfaces.length} bloquante(s), ${unvalidatedInterfaces.length} non validée(s)` },
    { label: "Anomalies critiques résolues", ok: criticalAnomalies.length === 0, detail: `${criticalAnomalies.length} anomalie(s) critique(s) ouverte(s)` },
    { label: "Autonomie utilisateurs ≥ 80%", ok: autonomyRate === null ? false : autonomyRate >= 0.8, detail: autonomyRate === null ? "aucune donnée de formation" : `${Math.round(autonomyRate * 100)}%` },
  ];

  const lastGoNoGo = project.decisions.find((d) => d.subject.toLowerCase().includes("go/no go") || d.subject.toLowerCase().includes("go no go"));

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Déploiement — Checklist Go / No Go</h1>

      <div className="card p-0 overflow-hidden mb-6">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Critère</th>
              <th>Statut</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {checklist.map((c, i) => (
              <tr key={i}>
                <td className="pl-4">{c.label}</td>
                <td>
                  <Pill text={c.ok ? "OK" : "À traiter"} tone={c.ok ? "ok" : "bad"} />
                </td>
                <td className="text-sm text-ink/60">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-ink/60 mb-1">
        Cette checklist ne couvre que les critères objectivables à partir des données du projet. Le paramétrage, la
        migration et la documentation restent à vérifier manuellement avant la décision finale.
      </p>
      {criticalAnomalies.length > 0 && (
        <p className="text-sm mb-4">
          <Link href={`/projects/${params.id}/validation`} className="text-blue hover:underline">
            Voir les anomalies critiques dans l'onglet Validation →
          </Link>
        </p>
      )}

      {lastGoNoGo ? (
        <div className="card mb-4">
          <div className="font-medium">Dernière décision enregistrée</div>
          <div className="text-sm mt-1">{lastGoNoGo.decision || lastGoNoGo.status}</div>
        </div>
      ) : null}

      <GoNoGoDecisionForm projectId={params.id} />
    </div>
  );
}
