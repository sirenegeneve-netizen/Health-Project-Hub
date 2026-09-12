import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { InitiativeTabs } from "@/components/InitiativeTabs";
import { InitiativeRelationsManager } from "@/components/InitiativeRelationsManager";
import { detectResourceConflicts, detectScheduleConflicts } from "@/lib/portfolioConflicts";

export const dynamic = "force-dynamic";

export default async function InitiativeRelationsPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: {
      relationsSource: { include: { initiativeCible: true } },
      relationsCible: { include: { initiativeSource: true } },
    },
  });
  if (!initiative) notFound();

  const relations = [
    ...initiative.relationsSource.map((r) => ({
      id: r.id,
      type: r.type,
      note: r.note,
      auto: r.auto,
      direction: "source" as const,
      other: { id: r.initiativeCible.id, name: r.initiativeCible.name },
    })),
    ...initiative.relationsCible.map((r) => ({
      id: r.id,
      type: r.type,
      note: r.note,
      auto: r.auto,
      direction: "cible" as const,
      other: { id: r.initiativeSource.id, name: r.initiativeSource.name },
    })),
  ];

  const otherInitiatives = await prisma.initiative.findMany({
    where: { id: { not: params.id } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Conflits détectés automatiquement (§9 point 4 de l'architecture) : recalculés
  // à la volée sur tout le portefeuille actif, puis filtrés sur ceux qui touchent
  // cette initiative — jamais persistés, donc toujours à jour avec les dates/
  // charges réelles au moment de l'affichage.
  const allActive = await prisma.initiative.findMany({
    where: { status: "actif" },
    include: {
      establishments: { include: { establishment: true } },
      actions: true,
      risks: true,
      interfaces: true,
      deliverables: true,
      actors: true,
      raciEntries: true,
    },
  });

  const scheduleConflicts = detectScheduleConflicts(
    allActive.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      targetDate: p.targetDate,
      establishments: p.establishments.map((e) => e.establishment),
    }))
  ).filter((c) => c.initiatives.some((i) => i.id === params.id));

  const resourceConflicts = detectResourceConflicts(
    allActive.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      actors: p.actors,
      workloadInputs: { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      raciEntries: p.raciEntries,
    }))
  ).filter((c) => c.initiatives.some((i) => i.id === params.id));

  return (
    <div>
      <InitiativeTabs initiativeId={initiative.id} />
      <div className="space-y-4">
        <InitiativeRelationsManager initiativeId={initiative.id} relations={relations} otherInitiatives={otherInitiatives} />

        <div className="card">
          <h3 className="font-medium text-ink mb-3">Conflits de planning détectés</h3>
          {scheduleConflicts.length === 0 ? (
            <p className="text-sm text-ink/40">Aucun conflit de planning détecté avec cette initiative.</p>
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
            <p className="text-sm text-ink/40">Aucune tension de ressource détectée avec cette initiative.</p>
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
    </div>
  );
}
