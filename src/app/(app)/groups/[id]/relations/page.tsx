import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GroupTabs } from "@/components/GroupTabs";
import { detectResourceConflicts, detectScheduleConflicts } from "@/lib/portfolioConflicts";

export const dynamic = "force-dynamic";

const RELATION_LABELS: Record<string, string> = {
  depend_de: "dépend de",
  prerequis_pour: "prérequis pour",
  impacte: "impacte",
  lie_a: "lié à",
  conflit_avec: "en conflit avec",
  ressource_partagee_avec: "partage une ressource avec",
};

export default async function GroupRelationsPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      initiatives: {
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
      },
    },
  });
  if (!group) notFound();

  const scheduleConflicts = detectScheduleConflicts(
    group.initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      targetDate: p.targetDate,
      establishments: p.establishments.map((e) => e.establishment),
    }))
  );
  const resourceConflicts = detectResourceConflicts(
    group.initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      actors: p.actors,
      workloadInputs: { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      raciEntries: p.raciEntries,
    }))
  );
  const declaredRelations = group.initiatives.flatMap((i) => i.relationsSource.map((r) => ({ ...r, source: i })));

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <div className="space-y-4">
        <div className="card">
          <h3 className="font-medium text-ink mb-3">Conflits détectés automatiquement</h3>
          {scheduleConflicts.length === 0 && resourceConflicts.length === 0 ? (
            <p className="text-sm text-ink/40">Aucun conflit de planning ou de ressource détecté.</p>
          ) : (
            <>
              {scheduleConflicts.map((c, i) => (
                <div key={`sc-${i}`} className="text-sm border-b border-line/60 pb-1.5 mb-1.5">
                  <span className="text-xs bg-bad/10 text-bad rounded px-2 py-0.5 mr-2">Conflit planning · {c.establishmentName}</span>
                  {c.initiatives.map((ci, j) => (
                    <span key={ci.id}>
                      {j > 0 && " ↔ "}
                      <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                        {ci.name}
                      </Link>
                    </span>
                  ))}
                </div>
              ))}
              {resourceConflicts.map((c, i) => (
                <div key={`rc-${i}`} className="text-sm border-b border-line/60 pb-1.5 mb-1.5">
                  <span className={`text-xs rounded px-2 py-0.5 mr-2 ${c.level === "rouge" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn"}`}>
                    Ressource · {c.name}
                  </span>
                  {c.initiatives.map((ci, j) => (
                    <span key={ci.id}>
                      {j > 0 && ", "}
                      <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                        {ci.name}
                      </Link>
                    </span>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="card">
          <h3 className="font-medium text-ink mb-3">Relations déclarées entre initiatives</h3>
          {declaredRelations.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune relation déclarée entre initiatives du groupe.</p>
          ) : (
            <ul className="space-y-1.5">
              {declaredRelations.map((r) => (
                <li key={r.id} className="text-sm border-b border-line/60 pb-1.5">
                  <Link href={`/initiatives/${r.source.id}/relations`} className="text-blue hover:underline">
                    {r.source.name}
                  </Link>{" "}
                  <span className="text-ink/50">{RELATION_LABELS[r.type] || r.type}</span>{" "}
                  <Link href={`/initiatives/${r.initiativeCibleId}/relations`} className="text-blue hover:underline">
                    {r.initiativeCible.name}
                  </Link>
                  {r.auto && <span className="text-xs text-ink/40 ml-2">(détecté)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
