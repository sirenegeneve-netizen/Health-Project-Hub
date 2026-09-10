import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { StageCriteriaList } from "@/components/StageCriteriaList";
import { ensureStageCriteria, computeStageCompletion } from "@/lib/stageCriteria";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

// Étape Préparation (§8 du prompt de refonte) : tout ce qui doit être prêt avant
// le déploiement proprement dit. La checklist est manuelle (aucune donnée
// existante ne la couvre) ; les modules déjà présents dans l'app (interfaces,
// paramétrage/conception, livrables) restent accessibles en lien profond pour
// ne pas dupliquer leur suivi ici.
export default async function PreparationPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  await ensureStageCriteria(params.id, "preparation");

  const [criteria, interfaces, deliverables] = await Promise.all([
    prisma.stageCriterion.findMany({ where: { projectId: params.id, stageKey: "preparation" }, orderBy: { order: "asc" } }),
    prisma.interface.findMany({ where: { projectId: params.id } }),
    prisma.deliverable.findMany({ where: { projectId: params.id } }),
  ]);

  const { percent, blocked } = computeStageCompletion(criteria);
  const blockingInterfaces = interfaces.filter((i) => i.isBlocking || i.status === "bloquant");
  const unvalidatedDeliverables = deliverables.filter((d) => d.status !== "valide");

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">Préparation</h1>
        <Pill text={`${percent}% prêt`} tone={blocked ? "bad" : percent === 100 ? "ok" : "warn"} />
      </div>
      <p className="text-sm text-muted mb-6">Tout ce qui doit être en place avant le déploiement.</p>

      <div className="card mb-6">
        <StageCriteriaList criteria={criteria} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href={`/projects/${params.id}/interfaces`} className="card block hover:bg-teal-50/40">
          <div className="font-medium text-sm mb-1">Interopérabilité</div>
          <div className="text-sm text-muted">
            {interfaces.length} interface(s){blockingInterfaces.length > 0 ? ` · ${blockingInterfaces.length} bloquante(s)` : ""}
          </div>
        </Link>
        <Link href={`/projects/${params.id}/conception`} className="card block hover:bg-teal-50/40">
          <div className="font-medium text-sm mb-1">Paramétrage & livrables</div>
          <div className="text-sm text-muted">
            {deliverables.length} livrable(s){unvalidatedDeliverables.length > 0 ? ` · ${unvalidatedDeliverables.length} non validé(s)` : ""}
          </div>
        </Link>
      </div>
    </div>
  );
}
