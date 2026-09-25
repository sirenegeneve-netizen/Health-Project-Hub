import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { ActorForm, ActorManageRow } from "@/components/ActorForms";
import { RaciBoard } from "@/components/RaciBoard";

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

export default async function GovernancePage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: params.id } });
  if (!initiative) notFound();

  const [activeActors, allActors, raciEntries] = await Promise.all([
    findInitiativeActors(params.id),
    findInitiativeActors(params.id, undefined, { includeInactive: true }),
    prisma.raciEntry.findMany({ where: { initiativeId: params.id } }),
  ]);
  const actors = allActors as unknown as Array<{
    id: string;
    name: string;
    actif: boolean;
    roleProjet: string | null;
    fonction: string | null;
    organisation: string | null;
    email: string | null;
    telephone: string | null;
    disponibiliteJh: number | null;
    competences: string | null;
  }>;

  const unavailabilities = await prisma.actorUnavailability.findMany({
    where: { actorId: { in: actors.map((a) => a.id) } },
    orderBy: { startDate: "asc" },
  });
  const unavailabilitiesByActor = new Map<string, typeof unavailabilities>();
  for (const u of unavailabilities) {
    if (!unavailabilitiesByActor.has(u.actorId)) unavailabilitiesByActor.set(u.actorId, []);
    unavailabilitiesByActor.get(u.actorId)!.push(u);
  }

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Gouvernance & RACI</h1>
        <p className="text-sm text-muted">Qui est responsable de quoi — la matrice est l'objet principal, pas une conséquence de la liste d'acteurs.</p>
      </div>

      {activeActors.length === 0 ? (
        <>
          <p className="text-sm text-body mb-3">Ajoutez d'abord les acteurs de l'initiative pour construire la matrice.</p>
          <ActorForm initiativeId={params.id} />
        </>
      ) : (
        <>
          <RaciBoard
            initiativeId={params.id}
            actors={activeActors.map((a) => ({ id: a.id, name: a.name }))}
            entries={raciEntries.map((e) => ({ actorId: e.actorId, activite: e.activite, role: e.role }))}
          />

          <details className="mt-8 group">
            <summary className="cursor-pointer text-sm text-muted hover:text-ink select-none">
              Gérer les acteurs ({actors.length})
            </summary>
            <div className="mt-4">
              <ActorForm initiativeId={params.id} />
              <div className="card p-0 overflow-hidden">
                <table className="table-hp">
                  <thead>
                    <tr className="bg-teal-50/50">
                      <th className="pl-4">Nom</th>
                      <th>Rôle</th>
                      <th>Fonction</th>
                      <th>Organisation</th>
                      <th>Contact</th>
                      <th>Disponibilité</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {actors.map((a) => (
                      <ActorManageRow
                        key={a.id}
                        actor={a}
                        roleLabels={ROLE_LABELS}
                        unavailabilities={(unavailabilitiesByActor.get(a.id) || []).map((u) => ({
                          id: u.id,
                          startDate: u.startDate.toISOString(),
                          endDate: u.endDate.toISOString(),
                          reason: u.reason,
                        }))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
