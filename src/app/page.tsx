import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { HealthBadge } from "@/components/HealthBadge";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await prisma.project.findMany({
    include: { establishments: { include: { establishment: true } } },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(projects.map((p) => computeHealthScore(p.id)));
  const establishmentsCount = await prisma.establishment.count();

  const atRisk = scores.filter((s) => s.level === "rouge").length;
  const toWatch = scores.filter((s) => s.level === "orange").length;
  const totalBudget = projects.reduce((s, p) => s + p.budgetJh, 0);
  const totalConsumed = projects.reduce((s, p) => s + p.jhConsommes, 0);
  const criticalInterfaces = scores.reduce((s, sc) => s + sc.metrics.blockingInterfaces, 0);
  const criticalActions = scores.reduce((s, sc) => s + sc.metrics.lateActions, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-teal-700">Portefeuille projets</h1>
        <p className="text-ink/60 mt-1">Vue groupe — pilotage, collaboration et mémoire des projets numériques en santé.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Projets" value={projects.length} />
        <Stat label="Établissements" value={establishmentsCount} />
        <Stat label="Projets à risque" value={atRisk} tone="bad" />
        <Stat label="À surveiller" value={toWatch} tone="warn" />
        <Stat label="Interfaces bloquantes" value={criticalInterfaces} tone="bad" />
        <Stat label="Actions en retard" value={criticalActions} tone="bad" />
        <Stat label="JH budgétés" value={totalBudget} />
        <Stat label="JH consommés" value={totalConsumed} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-5">Projet</th>
              <th>Établissement(s)</th>
              <th>Phase</th>
              <th>Priorité</th>
              <th>Cible</th>
              <th>Santé</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={p.id} className="hover:bg-teal-50/30">
                <td className="pl-5">
                  <Link href={`/projects/${p.id}`} className="font-medium text-teal-700 hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs text-ink/50">{p.reference}</div>
                </td>
                <td>{p.establishments.map((e) => e.establishment.name).join(", ") || "—"}</td>
                <td>
                  <Pill text={p.phase} />
                </td>
                <td>
                  <Pill text={p.priority} tone={p.priority === "critique" ? "bad" : p.priority === "haute" ? "warn" : "neutral"} />
                </td>
                <td>{p.targetDate ? new Date(p.targetDate).toLocaleDateString("fr-FR") : "—"}</td>
                <td>
                  <HealthBadge level={scores[i].level} label={scores[i].label} />
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-ink/50">
                  Aucun projet pour le moment.{" "}
                  <Link href="/projects/new" className="text-teal-700 underline">
                    Créer le premier projet
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  const toneClass = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`font-display text-3xl mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
