import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { getLifecycleStages } from "@/lib/lifecycle";
import { InitiativesExplorer, type ExplorerInitiative } from "@/components/InitiativesExplorer";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  deploiement: "Déploiement",
  evolution: "Évolution",
  interoperabilite: "Interopérabilité",
  migration: "Migration",
  mise_a_niveau: "Mise à niveau",
  cybersecurite: "Cybersécurité",
  reglementaire: "Réglementaire",
  formation: "Formation",
  audit: "Audit",
  autre: "Autre",
};

export default async function InitiativesPage({ searchParams }: { searchParams: { vue?: string } }) {
  const scope = await getScope();

  const initiatives = await prisma.initiative.findMany({
    where: initiativeScopeWhere(scope),
    include: { establishments: { include: { establishment: true } }, actions: true },
    orderBy: { createdAt: "desc" },
  });

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));

  const items: ExplorerInitiative[] = initiatives.map((p, i) => {
    const stages = getLifecycleStages(p.phase);
    const currentIdx = stages.findIndex((s) => s.status === "current");
    return {
      id: p.id,
      name: p.name,
      reference: p.reference,
      type: p.type,
      typeLabel: TYPE_LABELS[p.type] || p.type,
      status: p.status,
      priority: p.priority,
      chefDeProjet: p.chefDeProjet,
      targetDate: p.targetDate ? p.targetDate.toISOString() : null,
      establishments: p.establishments.map((e) => e.establishment.name),
      healthLevel: scores[i].level,
      healthLabel: scores[i].label,
      blocked: scores[i].metrics.blockingInterfaces > 0,
      progress: p.actions.length > 0 ? Math.round((p.actions.filter((a) => a.status === "termine").length / p.actions.length) * 100) : null,
      stageLabel: currentIdx >= 0 ? stages[currentIdx].label : stages[0].label,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Projets</h1>
        <p className="text-sm text-muted">
          {scope.establishmentName
            ? `Tous les projets de ${scope.establishmentName}.`
            : "Tous les projets du groupe, tous établissements confondus."}
        </p>
      </div>
      <InitiativesExplorer initiatives={items} initialTab={searchParams.vue} />
    </div>
  );
}
