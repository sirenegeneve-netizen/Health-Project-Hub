import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeActorWorkload, findSinglePointsOfFailure } from "@/lib/resourceGovernance";
import { getScope, projectScopeWhere } from "@/lib/scope";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const norm = (s: string) => s.trim().toLowerCase();

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

const DOT: Record<"vert" | "orange" | "rouge", string> = { vert: "bg-ok", orange: "bg-warn", rouge: "bg-bad" };

// Même seuil que le tableau de santé du portefeuille (colonne "Ressources") pour
// rester cohérent d'un écran à l'autre — pas de % fabriqué faute d'unité
// commune (les objets portés se comptent, les disponibilités déclarées sont en
// JH : les deux ne se convertissent pas l'un dans l'autre sans inventer un taux).
function levelFor(totalOwned: number): "vert" | "orange" | "rouge" {
  return totalOwned >= 8 ? "rouge" : totalOwned >= 5 ? "orange" : "vert";
}

export default async function PortfolioResourcesPage({ searchParams }: { searchParams: { vue?: string } }) {
  const vue = (["capacite", "charge", "dependances"] as const).includes(searchParams.vue as any) ? (searchParams.vue as "capacite" | "charge" | "dependances") : "charge";
  const scope = await getScope();

  const [actors, raciEntries, actions, risks, interfaces, deliverables] = await Promise.all([
    prisma.actor.findMany({ where: scope.establishmentId ? { project: projectScopeWhere(scope) } : undefined, include: { project: true }, orderBy: { name: "asc" } }),
    prisma.raciEntry.findMany(),
    prisma.action.findMany({ select: { projectId: true, responsable: true, responsableActorId: true, status: true } }),
    prisma.risk.findMany({ select: { projectId: true, proprietaire: true, proprietaireActorId: true, status: true } }),
    prisma.interface.findMany({ select: { projectId: true, responsable: true, responsableActorId: true, status: true } }),
    prisma.deliverable.findMany({ select: { projectId: true, responsable: true, responsableActorId: true, status: true } }),
  ]);

  if (actors.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Ressources & charge</h1>
        <div className="card text-center text-ink/50 py-14">
          Aucun acteur renseigné pour l'instant. Ajoutez des acteurs depuis l'onglet "Gouvernance & RACI" d'un projet.
        </div>
      </div>
    );
  }

  function byProject<T extends { projectId: string }>(list: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of list) {
      if (!map.has(item.projectId)) map.set(item.projectId, []);
      map.get(item.projectId)!.push(item);
    }
    return map;
  }
  const actionsByProject = byProject(actions);
  const risksByProject = byProject(risks);
  const interfacesByProject = byProject(interfaces);
  const deliverablesByProject = byProject(deliverables);

  // Regroupement par personne (nom normalisé) à travers tous les projets où elle apparaît.
  // Limite connue : rapprochement par nom, pas par identité — cf. diagnostic Phase 1 (§F.1).
  const groups = new Map<string, typeof actors>();
  for (const a of actors) {
    const key = norm(a.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const people = Array.from(groups.values()).map((records) => {
    let totalOwned = 0;
    let totalDispo: number | null = null;
    const roles = new Set<string>();
    const perProject = records.map((rec) => {
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
      if (rec.disponibiliteJh !== null) totalDispo = (totalDispo || 0) + rec.disponibiliteJh;
      if (rec.roleProjet) roles.add(rec.roleProjet);
      return { projectId: rec.projectId, projectName: rec.project.name, owned: w.totalOwned };
    });
    return { name: records[0].name, records, perProject, totalOwned, totalDispo, roles: Array.from(roles) };
  });

  people.sort((a, b) => b.totalOwned - a.totalOwned || b.records.length - a.records.length);
  const keyPeople = people.filter((p) => p.records.length > 1);
  const inTension = people.filter((p) => levelFor(p.totalOwned) !== "vert");

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
  const totalDependencies = Array.from(dependenciesByProject.values()).reduce((s, d) => s + d.length, 0);

  const TABS = [
    { key: "capacite", label: "Capacité" },
    { key: "charge", label: "Charge" },
    { key: "dependances", label: `Dépendances${totalDependencies > 0 ? ` (${totalDependencies})` : ""}` },
  ] as const;

  return (
    <div>
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Ressources & charge</h1>
        <p className="text-sm text-muted">
          Qui est disponible, qui est mobilisé sur quoi, et où sont les fragilités — vue portefeuille.
          {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-5">
        <div className="card">
          <div className="label">Personnes mobilisées</div>
          <div className="font-display text-2xl mt-0.5">{people.length}</div>
        </div>
        <div className="card">
          <div className="label">Sur plusieurs projets</div>
          <div className="font-display text-2xl mt-0.5">{keyPeople.length}</div>
        </div>
        {inTension.length > 0 && (
          <div className="card">
            <div className="label text-warn">En tension</div>
            <div className="font-display text-2xl mt-0.5 text-warn">{inTension.length}</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-5 border-b border-line">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`?vue=${t.key}`}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              vue === t.key ? "border-primary text-primary font-medium" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {vue === "capacite" && (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Personne</th>
                <th>Rôle(s)</th>
                <th>Projets</th>
                <th>Disponibilité déclarée</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.name}>
                  <td className="pl-4 font-medium">{p.name}</td>
                  <td className="text-sm text-ink/70">{p.roles.map((r) => ROLE_LABELS[r] || r).join(", ") || "—"}</td>
                  <td className="text-xs">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {p.perProject.map((pp) => (
                        <Link key={pp.projectId} href={`/projects/${pp.projectId}`} className="hover:underline hover:text-blue">
                          {pp.projectName}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td>{p.totalDispo !== null ? `${p.totalDispo} JH` : <span className="text-ink/40">non renseignée</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vue === "charge" && (
        <div className="space-y-2.5">
          <p className="text-xs text-ink/40">
            Charge mesurée en nombre d'actions, risques, interfaces et livrables ouverts portés par chaque personne — pas en %,
            faute d'estimation de charge en JH sur ces objets. Seuils : ≥5 objets = à surveiller, ≥8 = en tension.
          </p>
          {people.map((p) => {
            const level = levelFor(p.totalOwned);
            return (
              <div key={p.name} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium text-ink flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${DOT[level]}`} />
                      {p.name}
                      {p.records.length > 1 && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary">
                          {p.records.length} projets
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted mt-1">
                      {p.perProject.map((pp) => (
                        <Link key={pp.projectId} href={`/projects/${pp.projectId}`} className="hover:underline hover:text-blue">
                          {pp.projectName} ({pp.owned})
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    {p.totalDispo !== null && <span className="text-muted">{p.totalDispo} JH dispo</span>}
                    <span className="text-body font-medium">{p.totalOwned} objet(s) ouvert(s)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vue === "dependances" && (
        <div>
          {dependenciesByProject.size === 0 ? (
            <div className="card text-center text-ink/50 py-14">
              Aucune activité RACI reposant sur une seule personne détectée pour l'instant.
            </div>
          ) : (
            <div className="card border-bad/20">
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
        </div>
      )}
    </div>
  );
}
