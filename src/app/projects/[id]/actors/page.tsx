import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActorForm, RaciMatrix } from "@/components/ActorForms";
import { computeActorWorkload, findSinglePointsOfFailure } from "@/lib/resourceGovernance";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  chef_de_projet: "Chef de projet",
  consultant: "Consultant",
  consultant_fonctionnel: "Consultant fonctionnel",
  consultant_interop: "Consultant interopérabilité",
  expert_metier: "Expert métier",
  developpeur: "Développeur",
  formateur: "Formateur",
  support: "Support",
  expert_externe: "Expert externe",
  referent_etablissement: "Référent établissement",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ResourcesPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const [actors, raciEntries, actions, risks, interfaces, deliverables] = await Promise.all([
    prisma.actor.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.raciEntry.findMany({ where: { projectId: params.id } }),
    prisma.action.findMany({ where: { projectId: params.id }, select: { responsable: true, status: true } }),
    prisma.risk.findMany({ where: { projectId: params.id }, select: { proprietaire: true, status: true } }),
    prisma.interface.findMany({ where: { projectId: params.id }, select: { responsable: true, status: true } }),
    prisma.deliverable.findMany({ where: { projectId: params.id }, select: { responsable: true, status: true } }),
  ]);

  const workloadInputs = { actions, risks, interfaces, deliverables };
  const workloads = new Map(actors.map((a) => [a.id, computeActorWorkload(a, workloadInputs, raciEntries)]));
  const actorsById = new Map(actors.map((a) => [a.id, a.name]));
  const dependencies = findSinglePointsOfFailure(raciEntries, actorsById);

  const totalCharge = Array.from(workloads.values()).reduce((s, w) => s + w.totalOwned, 0);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Ressources & gouvernance</h1>
        <p className="text-sm text-muted">Qui porte quoi, avec quelle charge réelle, et où sont les points de fragilité.</p>
      </div>

      {actors.length === 0 ? (
        <>
          <ActorForm projectId={params.id} />
          <div className="card text-center text-ink/50 py-10 mt-4">Aucun acteur renseigné pour ce projet.</div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-5">
            <div className="card">
              <div className="label">Acteurs clés</div>
              <div className="font-display text-2xl mt-0.5">{actors.length}</div>
            </div>
            {totalCharge > 0 && (
              <div className="card">
                <div className="label">Charge ouverte portée par l'équipe</div>
                <div className="font-display text-2xl mt-0.5">{totalCharge}</div>
                <div className="text-xs text-muted mt-0.5">actions, risques, interfaces et livrables en cours</div>
              </div>
            )}
            {dependencies.length > 0 && (
              <div className="card">
                <div className="label text-bad">Dépendances critiques</div>
                <div className="font-display text-2xl mt-0.5 text-bad">{dependencies.length}</div>
                <div className="text-xs text-muted mt-0.5">activité(s) portée(s) par une seule personne</div>
              </div>
            )}
          </div>

          {dependencies.length > 0 && (
            <div className="card mb-5 border-bad/20">
              <div className="flex items-center gap-2 font-medium text-bad mb-2">
                <AlertTriangle size={16} />
                Points de dépendance uniques
              </div>
              <ul className="text-sm space-y-1">
                {dependencies.map((d, i) => (
                  <li key={i} className="text-body">
                    <span className="font-medium">{d.activite}</span> repose entièrement sur <span className="font-medium">{d.actorName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ActorForm projectId={params.id} />

          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {actors.map((a) => {
              const w = workloads.get(a.id)!;
              const raciBadges = (["R", "A", "C", "I"] as const).filter((r) => w.raci[r] > 0);
              return (
                <div key={a.id} className="card flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-50 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials(a.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-ink truncate">{a.name}</div>
                      {a.disponibiliteJh !== null && <span className="text-xs text-muted shrink-0">{a.disponibiliteJh} JH dispo</span>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {a.roleProjet ? ROLE_LABELS[a.roleProjet] || a.roleProjet : "Rôle non renseigné"}
                      {a.organisation && ` · ${a.organisation}`}
                    </div>
                    {w.totalOwned > 0 && (
                      <div className="text-xs text-body mt-2">
                        {[
                          w.openActions > 0 && `${w.openActions} action(s)`,
                          w.ownedRisks > 0 && `${w.ownedRisks} risque(s)`,
                          w.ownedInterfaces > 0 && `${w.ownedInterfaces} interface(s)`,
                          w.ownedDeliverables > 0 && `${w.ownedDeliverables} livrable(s)`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {raciBadges.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {raciBadges.map((r) => (
                          <span key={r} className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-ink/5 text-ink/70">
                            {r}×{w.raci[r]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <RaciMatrix projectId={params.id} actors={actors.map((a) => ({ id: a.id, name: a.name }))} entries={raciEntries} />
        </>
      )}
    </div>
  );
}
