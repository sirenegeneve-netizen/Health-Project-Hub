import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ActorForm, RaciMatrix } from "@/components/ActorForms";

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

export default async function ActorsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const actors = await prisma.actor.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } });
  const raciEntries = await prisma.raciEntry.findMany({ where: { projectId: params.id } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Acteurs & RACI</h1>
      <ActorForm projectId={params.id} />

      {actors.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucun acteur renseigné pour ce projet.</div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden mb-6">
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

          <RaciMatrix
            projectId={params.id}
            actors={actors.map((a) => ({ id: a.id, name: a.name }))}
            entries={raciEntries}
          />
        </>
      )}
    </div>
  );
}
