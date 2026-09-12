import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabs } from "@/components/InitiativeTabs";
import { ActorForm } from "@/components/ActorForms";
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

  const [actors, raciEntries] = await Promise.all([
    findInitiativeActors(params.id),
    prisma.raciEntry.findMany({ where: { initiativeId: params.id } }),
  ]);

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Gouvernance & RACI</h1>
        <p className="text-sm text-muted">Qui est responsable de quoi — la matrice est l'objet principal, pas une conséquence de la liste d'acteurs.</p>
      </div>

      {actors.length === 0 ? (
        <>
          <p className="text-sm text-body mb-3">Ajoutez d'abord les acteurs du projet pour construire la matrice.</p>
          <ActorForm initiativeId={params.id} />
        </>
      ) : (
        <>
          <RaciBoard
            initiativeId={params.id}
            actors={actors.map((a) => ({ id: a.id, name: a.name }))}
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
                      <th>Rôle projet</th>
                      <th>Fonction</th>
                      <th>Organisation</th>
                      <th>Contact</th>
                      <th>Disponibilité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actors.map((a) => (
                      <tr key={a.id}>
                        <td className="pl-4 font-medium">{a.name}</td>
                        <td>{a.roleProjet ? ROLE_LABELS[a.roleProjet] || a.roleProjet : "—"}</td>
                        <td>{a.fonction || "—"}</td>
                        <td>{a.organisation || "—"}</td>
                        <td className="text-sm">{a.email || "—"}</td>
                        <td>{a.disponibiliteJh !== null ? `${a.disponibiliteJh} JH` : "—"}</td>
                      </tr>
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
