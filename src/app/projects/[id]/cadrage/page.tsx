import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ProjectDescriptionEditor } from "@/components/ProjectDescriptionEditor";
import { StakeholderForm } from "@/components/EntityForms";
import { ActorForm, RaciMatrix } from "@/components/ActorForms";
import { BudgetTargetsForm, BudgetLineForm, BudgetLinesTable } from "@/components/BudgetForms";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
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
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function CadragePage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { budgetLines: true, baselines: { orderBy: { createdAt: "asc" } }, establishments: { include: { establishment: true } } },
  });
  if (!project) notFound();

  const [stakeholders, actors, raciEntries, actions, risks, interfaces, deliverables] = await Promise.all([
    prisma.stakeholder.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
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
  const budget = computeBudgetSummary(project.budgetInitialEur, project.budgetReviseEur, project.budgetLines);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Cadrage</h1>
        <p className="text-sm text-muted">Ce qui définit le projet : objectifs, parties prenantes, gouvernance, budget et planning de départ.</p>
      </div>

      <section className="mt-8">
        <SectionTitle>Objectifs & périmètre</SectionTitle>
        <ProjectDescriptionEditor projectId={params.id} initial={project.description || ""} />
      </section>

      <section className="mt-10">
        <SectionTitle>Parties prenantes</SectionTitle>
        <StakeholderForm projectId={params.id} />
        {stakeholders.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Nom</th>
                  <th>Organisation</th>
                  <th>Rôle</th>
                  <th>Implication</th>
                  <th>Influence</th>
                </tr>
              </thead>
              <tbody>
                {stakeholders.map((s) => (
                  <tr key={s.id}>
                    <td className="pl-4 font-medium">{s.name}</td>
                    <td>{s.organisation || "—"}</td>
                    <td>{s.role || "—"}</td>
                    <td className="capitalize">{s.implication || "—"}</td>
                    <td className="capitalize">{s.influence || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune partie prenante renseignée.</div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Gouvernance & RACI</SectionTitle>
          <Link href={`/projects/${params.id}/actors`} className="text-sm text-blue hover:underline">
            Vue détaillée →
          </Link>
        </div>
        <ActorForm projectId={params.id} />

        {dependencies.length > 0 && (
          <div className="card mb-4 border-bad/20">
            <div className="flex items-center gap-2 font-medium text-bad mb-2 text-sm">
              <AlertTriangle size={15} />
              Points de dépendance uniques
            </div>
            <ul className="text-sm space-y-1">
              {dependencies.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.activite}</span> repose entièrement sur <span className="font-medium">{d.actorName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actors.length > 0 ? (
          <>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              {actors.map((a) => {
                const w = workloads.get(a.id)!;
                return (
                  <div key={a.id} className="card flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink text-sm truncate">{a.name}</div>
                      <div className="text-xs text-muted">
                        {a.roleProjet ? ROLE_LABELS[a.roleProjet] || a.roleProjet : "Rôle non renseigné"}
                        {a.disponibiliteJh !== null && ` · ${a.disponibiliteJh} JH dispo`}
                      </div>
                      {w.totalOwned > 0 && <div className="text-xs text-body mt-1">{w.totalOwned} élément(s) porté(s)</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <RaciMatrix projectId={params.id} actors={actors.map((a) => ({ id: a.id, name: a.name }))} entries={raciEntries} />
          </>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun acteur renseigné pour ce projet.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Budget initial</SectionTitle>
        <BudgetTargetsForm projectId={params.id} budgetInitialEur={project.budgetInitialEur} budgetReviseEur={project.budgetReviseEur} />
        {budget ? (
          <div className="card mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="label">Budget</div>
                <div className="font-display text-xl mt-0.5">{formatEur(budget.budget)}</div>
              </div>
              <div>
                <div className="label">Engagé</div>
                <div className="font-display text-xl mt-0.5">{formatEur(budget.engage)}</div>
              </div>
              <div>
                <div className="label">Réel</div>
                <div className="font-display text-xl mt-0.5">{formatEur(budget.reel)}</div>
              </div>
              <div>
                <div className="label">Reste</div>
                <div className={`font-display text-xl mt-0.5 ${budget.reste < 0 ? "text-bad" : "text-ok"}`}>{formatEur(budget.reste)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-6 mb-4">Aucun budget renseigné pour ce projet.</div>
        )}
        <BudgetLineForm projectId={params.id} />
        {project.budgetLines.length > 0 && <BudgetLinesTable lines={project.budgetLines} />}
      </section>

      <section className="mt-10 mb-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Planning initial</SectionTitle>
          <Link href={`/projects/${params.id}/planning`} className="text-sm text-blue hover:underline">
            Voir le planning détaillé →
          </Link>
        </div>
        {project.baselines.length > 0 ? (
          <div className="card">
            <ul className="text-sm space-y-1.5">
              {project.baselines.map((b) => (
                <li key={b.id} className="flex justify-between text-body">
                  <span>
                    {b.label} {b.reason && <span className="text-muted">— {b.reason}</span>}
                  </span>
                  <span className="text-muted">{new Date(b.targetDate).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-6">Aucune date cible renseignée pour l'instant.</div>
        )}
      </section>
    </div>
  );
}
