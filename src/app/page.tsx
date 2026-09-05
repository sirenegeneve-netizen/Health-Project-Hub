import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { HealthBadge, HealthBar } from "@/components/HealthBadge";
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
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="label mb-2">Portefeuille</div>
          <h1 className="font-display text-4xl text-teal-700 leading-tight">
            {projects.length > 0 ? `${projects.length} projet${projects.length > 1 ? "s" : ""} en cours` : "Votre portefeuille"}
          </h1>
          <p className="text-ink/60 mt-2 max-w-xl">
            Vue d'ensemble des projets numériques en santé du groupe — état, planning et points d'attention en un
            coup d'œil.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-teal-100 rounded-lg overflow-hidden border border-teal-100">
        <Stat label="Projets" value={projects.length} />
        <Stat label="Établissements" value={establishmentsCount} />
        <Stat label="À risque" value={atRisk} tone="bad" />
        <Stat label="À surveiller" value={toWatch} tone="warn" />
        <Stat label="Interfaces bloquantes" value={criticalInterfaces} tone="bad" />
        <Stat label="Actions en retard" value={criticalActions} tone="bad" />
        <Stat label="JH budgétés" value={totalBudget} />
        <Stat label="JH consommés" value={totalConsumed} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-ink">Projets</h2>
          <Link href="/projects/new" className="text-sm text-teal-700 hover:underline">
            + Nouveau projet
          </Link>
        </div>

        <div className="space-y-2.5">
          {projects.map((p, i) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="row-link">
              <div className="relative overflow-hidden card flex items-center justify-between gap-6 pl-6">
                <HealthBar level={scores[i].level} />
                <div className="min-w-0">
                  <div className="font-display text-lg text-ink truncate">{p.name}</div>
                  <div className="text-xs text-ink/45 mt-0.5">
                    {p.reference} · {p.establishments.map((e) => e.establishment.name).join(", ") || "établissement non défini"}
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <Pill text={p.phase.replace(/_/g, " ")} />
                  <span className="text-sm text-ink/60 hidden sm:inline">
                    {p.targetDate ? new Date(p.targetDate).toLocaleDateString("fr-FR") : "—"}
                  </span>
                  <HealthBadge level={scores[i].level} label={scores[i].label} />
                </div>
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="card text-center py-14">
              <p className="text-ink/60 mb-4">Aucun projet pour le moment.</p>
              <Link href="/projects/new" className="btn">
                Créer le premier projet
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  const toneClass = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-teal-700";
  return (
    <div className="bg-sand px-5 py-4">
      <div className="label">{label}</div>
      <div className={`font-display text-3xl mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
