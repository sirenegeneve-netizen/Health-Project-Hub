import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeActorWorkload, findSinglePointsOfFailure } from "@/lib/resourceGovernance";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const norm = (s: string) => s.trim().toLowerCase();

export default async function PortfolioResourcesPage() {
  const [actors, raciEntries, actions, risks, interfaces, deliverables] = await Promise.all([
    prisma.actor.findMany({ include: { project: true }, orderBy: { name: "asc" } }),
    prisma.raciEntry.findMany(),
    prisma.action.findMany({ select: { projectId: true, responsable: true, status: true } }),
    prisma.risk.findMany({ select: { projectId: true, proprietaire: true, status: true } }),
    prisma.interface.findMany({ select: { projectId: true, responsable: true, status: true } }),
    prisma.deliverable.findMany({ select: { projectId: true, responsable: true, status: true } }),
  ]);

  if (actors.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Ressources</h1>
        <div className="card text-center text-ink/50 py-14">
          Aucun acteur renseigné pour l'instant. Ajoutez des acteurs depuis l'onglet "Ressources" d'un projet.
        </div>
      </div>
    );
  }

  const byProject = (list: { projectId: string }[]) => {
    const map = new Map<string, typeof list>();
    for (const item of list) {
      if (!map.has(item.projectId)) map.set(item.projectId, []);
      map.get(item.projectId)!.push(item);
    }
    return map;
  };
  const actionsByProject = byProject(actions);
  const risksByProject = byProject(risks);
  const interfacesByProject = byProject(interfaces);
  const deliverablesByProject = byProject(deliverables);

  // Regroupement par personne (nom normalisé) à travers tous les projets où elle apparaît.
  const groups = new Map<string, typeof actors>();
  for (const a of actors) {
    const key = norm(a.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const people = Array.from(groups.values()).map((records) => {
    let totalOwned = 0;
    let totalDispo: number | null = null;
    const raciTotals = { R: 0, A: 0, C: 0, I: 0 };
    for (const rec of records) {
      const w = computeActorWorkload(
        rec,
        {
          actions: actionsByProject.get(rec.projectId) || [],
          risks: risksByProject.get(rec.projectId) || [],
          interfaces: interfacesByProject.get(rec.projectId) || [],
          deliverables: deliverablesByProject.get(rec.projectId) || [],
        },
        raciEntries
      );
      totalOwned += w.totalOwned;
      raciTotals.R += w.raci.R;
      raciTotals.A += w.raci.A;
      raciTotals.C += w.raci.C;
      raciTotals.I += w.raci.I;
      if (rec.disponibiliteJh !== null) totalDispo = (totalDispo || 0) + rec.disponibiliteJh;
    }
    return { name: records[0].name, records, totalOwned, totalDispo, raciTotals };
  });

  people.sort((a, b) => b.records.length - a.records.length || b.totalOwned - a.totalOwned);

  const keyPeople = people.filter((p) => p.records.length > 1);

  // Dépendances critiques agrégées par projet.
  const dependenciesByProject = new Map<string, { activite: string; actorName: string }[]>();
  const projectIds = Array.from(new Set(actors.map((a) => a.projectId)));
  for (const pid of projectIds) {
    const projectActors = actors.filter((a) => a.projectId === pid);
    const projectRaci = raciEntries.filter((r) => r.projectId === pid);
    const actorsById = new Map(projectActors.map((a) => [a.id, a.name]));
    const deps = findSinglePointsOfFailure(projectRaci, actorsById);
    if (deps.length > 0) dependenciesByProject.set(pid, deps);
  }
  const projectNameById = new Map(actors.map((a) => [a.projectId, a.project.name]));

  return (
    <div>
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Ressources</h1>
        <p className="text-sm text-muted">Vue portefeuille : qui est mobilisé, sur combien de projets, et où sont les fragilités.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-5">
        <div className="card">
          <div className="label">Personnes mobilisées</div>
          <div className="font-display text-2xl mt-0.5">{people.length}</div>
        </div>
        {keyPeople.length > 0 && (
          <div className="card">
            <div className="label">Sur plusieurs projets</div>
            <div className="font-display text-2xl mt-0.5">{keyPeople.length}</div>
          </div>
        )}
        {dependenciesByProject.size > 0 && (
          <div className="card">
            <div className="label text-bad">Dépendances critiques</div>
            <div className="font-display text-2xl mt-0.5 text-bad">
              {Array.from(dependenciesByProject.values()).reduce((s, d) => s + d.length, 0)}
            </div>
          </div>
        )}
      </div>

      {dependenciesByProject.size > 0 && (
        <div className="card mb-5 border-bad/20">
          <div className="flex items-center gap-2 font-medium text-bad mb-2">
            <AlertTriangle size={16} />
            Points de dépendance uniques
          </div>
          <ul className="text-sm space-y-1">
            {Array.from(dependenciesByProject.entries()).flatMap(([pid, deps]) =>
              deps.map((d, i) => (
                <li key={`${pid}-${i}`}>
                  <Link href={`/projects/${pid}`} className="text-blue hover:underline">
                    {projectNameById.get(pid)}
                  </Link>
                  {" — "}
                  <span className="font-medium">{d.activite}</span> repose entièrement sur <span className="font-medium">{d.actorName}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="space-y-2.5">
        {people.map((p) => (
          <div key={p.name} className="card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-medium text-ink flex items-center gap-2">
                  {p.name}
                  {p.records.length > 1 && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary">
                      {p.records.length} projets
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted mt-1">
                  {p.records.map((r) => (
                    <Link key={r.id} href={`/projects/${r.projectId}`} className="hover:underline hover:text-blue">
                      {r.project.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                {p.totalDispo !== null && <span className="text-muted">{p.totalDispo} JH dispo</span>}
                {p.totalOwned > 0 && <span className="text-body">{p.totalOwned} élément(s) porté(s)</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
