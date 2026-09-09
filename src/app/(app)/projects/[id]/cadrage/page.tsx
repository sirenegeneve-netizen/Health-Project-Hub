import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { EditableField } from "@/components/ProjectDescriptionEditor";
import { StakeholderForm, RiskForm } from "@/components/EntityForms";
import { ActorForm } from "@/components/ActorForms";
import { BudgetTargetsForm, BudgetLineForm, BudgetLinesTable } from "@/components/BudgetForms";
import { computeBudgetSummary, formatEur } from "@/lib/metrics";
import { findSinglePointsOfFailure } from "@/lib/resourceGovernance";
import { computeCadrageReadiness } from "@/lib/readiness";
import { HealthBadge } from "@/components/HealthBadge";
import { Pill } from "@/components/Pill";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function CadragePage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { budgetLines: true, baselines: { orderBy: { createdAt: "asc" } }, establishments: { include: { establishment: true } } },
  });
  if (!project) notFound();

  const [stakeholders, actors, raciEntries, risks] = await Promise.all([
    prisma.stakeholder.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
    prisma.actor.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.raciEntry.findMany({ where: { projectId: params.id } }),
    prisma.risk.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const actorsById = new Map(actors.map((a) => [a.id, a.name]));
  const dependencies = findSinglePointsOfFailure(raciEntries, actorsById);
  const budget = computeBudgetSummary(project.budgetInitialEur, project.budgetReviseEur, project.budgetLines);

  const filled = (v: string | null) => !!v && v.trim().length > 0;
  const readiness = computeCadrageReadiness({
    hasObjectifs: filled(project.description) && filled(project.objectifs) && filled(project.perimetre),
    stakeholdersCount: stakeholders.length,
    actorsCount: actors.length,
    hasBudget: budget !== null,
    hasTargetDate: !!project.targetDate,
  });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="font-display text-2xl text-ink">Cadrage</h1>
          <p className="text-sm text-muted">Le projet est-il suffisamment cadré pour être lancé ?</p>
        </div>
        <HealthBadge level={readiness.level} label={readiness.label} />
      </div>
      <ul className="text-sm text-body mt-3 mb-2 space-y-1">
        {readiness.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-muted">·</span>
            {r}
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <SectionTitle>Contexte & enjeux</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <EditableField projectId={params.id} field="description" label="Contexte" placeholder="Pourquoi ce projet, dans quel contexte ?" initial={project.description || ""} />
          <EditableField projectId={params.id} field="enjeux" label="Enjeux" placeholder="Ce qui est en jeu pour l'établissement, les équipes, les patients…" initial={project.enjeux || ""} />
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle>Objectifs & critères de succès</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <EditableField projectId={params.id} field="objectifs" label="Objectifs" placeholder="Ce que le projet doit permettre d'atteindre" initial={project.objectifs || ""} />
          <EditableField projectId={params.id} field="criteresSucces" label="Critères de succès" placeholder="Comment saura-t-on que le projet a réussi ?" initial={project.criteresSucces || ""} />
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle>Périmètre</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <EditableField projectId={params.id} field="perimetre" label="Périmètre" placeholder="Ce qui est couvert par le projet" initial={project.perimetre || ""} />
          <EditableField projectId={params.id} field="exclusions" label="Exclusions" placeholder="Ce qui est explicitement hors périmètre" initial={project.exclusions || ""} />
        </div>
        {project.establishments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.establishments.map((e) => (
              <Pill key={e.id} text={e.establishment.name} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 mb-4">
        <SectionTitle>Hypothèses & contraintes</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <EditableField projectId={params.id} field="hypotheses" label="Hypothèses" placeholder="Ce qu'on suppose vrai au démarrage" initial={project.hypotheses || ""} />
          <EditableField projectId={params.id} field="contraintes" label="Contraintes" placeholder="Délais, budget, ressources, réglementation…" initial={project.contraintes || ""} />
        </div>
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
            Ouvrir la matrice →
          </Link>
        </div>

        {actors.length === 0 ? (
          <>
            <p className="text-sm text-body mb-3">Aucun acteur renseigné pour ce projet.</p>
            <ActorForm projectId={params.id} />
          </>
        ) : (
          <div className="card">
            <div className="text-sm text-body">
              {actors.length} acteur(s) impliqué(s)
              {dependencies.length > 0 && (
                <span className="text-bad">
                  {" "}
                  · {dependencies.length} dépendance(s) critique(s) (
                  {dependencies.map((d) => d.actorName).join(", ")})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {actors.map((a) => (
                <span key={a.id} className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-1">
                  {a.name}
                  {a.roleProjet && ` · ${ROLE_LABELS[a.roleProjet] || a.roleProjet}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Risques initiaux</SectionTitle>
          <Link href={`/projects/${params.id}/risks`} className="text-sm text-blue hover:underline">
            Registre complet →
          </Link>
        </div>
        <RiskForm projectId={params.id} />
        {risks.length > 0 ? (
          <div className="space-y-2">
            {risks.slice(0, 5).map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-4">
                <span className="text-sm">{r.description}</span>
                <Pill text={r.criticite} tone={["forte", "critique"].includes(r.criticite) ? "bad" : "neutral"} />
              </div>
            ))}
            {risks.length > 5 && <div className="text-xs text-muted">+ {risks.length - 5} autre(s) — voir le registre complet</div>}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun risque identifié à ce stade.</div>
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
