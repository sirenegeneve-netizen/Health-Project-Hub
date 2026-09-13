import Link from "next/link";
import { prisma } from "@/lib/db";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { detectResourceConflicts, detectScheduleConflicts } from "@/lib/portfolioConflicts";
import { PortfolioTabs } from "@/components/PortfolioTabs";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  depend_de: "Dépend de",
  prerequis_pour: "Prérequis pour",
  impacte: "Impacte",
  lie_a: "Liée à",
  conflit_avec: "En conflit avec",
  ressource_partagee_avec: "Ressource partagée avec",
};

export default async function PortfolioRelationsPage() {
  const scope = await getScope();

  const initiatives = await prisma.initiative.findMany({
    where: initiativeScopeWhere(scope),
    include: {
      establishments: { include: { establishment: true } },
      actions: true,
      risks: true,
      interfaces: true,
      deliverables: true,
      actors: true,
      raciEntries: true,
      relationsSource: { include: { initiativeCible: true } },
    },
  });

  const relations = initiatives.flatMap((p) =>
    p.relationsSource.map((r) => ({
      id: r.id,
      type: r.type,
      note: r.note,
      from: { id: p.id, name: p.name },
      to: { id: r.initiativeCible.id, name: r.initiativeCible.name },
    }))
  );

  const scheduleConflicts = detectScheduleConflicts(
    initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      targetDate: p.targetDate,
      establishments: p.establishments.map((e) => e.establishment),
    }))
  );

  const resourceConflicts = detectResourceConflicts(
    initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      actors: p.actors,
      workloadInputs: { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      raciEntries: p.raciEntries,
    }))
  );

  const multiEstablishment = initiatives.filter((p) => p.establishments.length > 1);

  return (
    <div>
      <PortfolioTabs />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Interactions & dépendances</h1>
        <p className="text-sm text-muted">
          Relations déclarées entre initiatives, conflits détectés automatiquement, impacts multi-établissements.
          {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h3 className="font-medium text-ink mb-3">Relations déclarées</h3>
          {relations.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune relation déclarée sur ce périmètre.</p>
          ) : (
            <ul className="space-y-1.5">
              {relations.map((r) => (
                <li key={r.id} className="text-sm border-b border-line/60 pb-1.5">
                  <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5 mr-2">{TYPE_LABELS[r.type] || r.type}</span>
                  <Link href={`/initiatives/${r.from.id}`} className="text-blue hover:underline">
                    {r.from.name}
                  </Link>
                  <span className="text-ink/40 mx-1.5">→</span>
                  <Link href={`/initiatives/${r.to.id}`} className="text-blue hover:underline">
                    {r.to.name}
                  </Link>
                  {r.note && <span className="text-ink/50"> — {r.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-medium text-ink mb-3">Conflits de planning détectés</h3>
            {scheduleConflicts.length === 0 ? (
              <p className="text-sm text-ink/40">Aucun conflit détecté.</p>
            ) : (
              <ul className="space-y-2">
                {scheduleConflicts.map((c, i) => (
                  <li key={i} className="text-sm border-b border-line/60 pb-1.5">
                    <span className="text-xs bg-bad/10 text-bad rounded px-2 py-0.5 mr-2">{c.establishmentName}</span>
                    {c.initiatives.map((ci, j) => (
                      <span key={ci.id}>
                        {j > 0 && " ↔ "}
                        <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                          {ci.name}
                        </Link>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="font-medium text-ink mb-3">Ressources partagées en tension</h3>
            {resourceConflicts.length === 0 ? (
              <p className="text-sm text-ink/40">Aucune tension détectée.</p>
            ) : (
              <ul className="space-y-2">
                {resourceConflicts.map((c, i) => (
                  <li key={i} className="text-sm border-b border-line/60 pb-1.5">
                    <span className={`text-xs rounded px-2 py-0.5 mr-2 ${c.level === "rouge" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn"}`}>
                      {c.name}
                    </span>
                    {c.initiatives.map((ci, j) => (
                      <span key={ci.id}>
                        {j > 0 && ", "}
                        <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                          {ci.name}
                        </Link>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-medium text-ink mb-3">Initiatives multi-établissements</h3>
          {multiEstablishment.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune initiative multi-établissements.</p>
          ) : (
            <ul className="space-y-1.5">
              {multiEstablishment.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link href={`/initiatives/${p.id}`} className="text-blue hover:underline font-medium">
                    {p.name}
                  </Link>
                  <span className="text-ink/40 text-xs ml-2">{p.establishments.map((e) => e.establishment.name).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
