import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { Pill, statusTone } from "@/components/Pill";
import { ActionForm } from "@/components/EntityForms";

export const dynamic = "force-dynamic";

export default async function EstablishmentActionsPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!establishment) notFound();

  const [actions, actors] = await Promise.all([
    prisma.action.findMany({
      where: { establishmentId: params.id },
      include: { initiative: true, responsableActor: true },
      orderBy: [{ status: "asc" }, { echeance: "asc" }],
    }),
    prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
  ]);
  const now = new Date();
  const lateActions = actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status));

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <p className="text-sm text-ink/60 mb-4">
        Actions des initiatives taguées pour cet établissement, et actions propres à l'établissement, {lateActions.length} en retard sur{" "}
        {actions.length}. Une action liée à une initiative se crée depuis celle-ci, en la rattachant à cet établissement ; une action propre
        à l'établissement peut se créer directement ici.
      </p>

      <ActionForm initiativeId="" ownerType="etablissement" ownerId={establishment.id} actors={actors} label="+ Nouvelle action propre à l'établissement" />

      {actions.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune action pour cet établissement.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Action</th>
                <th>Initiative</th>
                <th>Responsable</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const late = a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status);
                return (
                  <tr key={a.id}>
                    <td className="pl-4 text-sm">{a.title}</td>
                    <td className="text-sm">
                      {a.initiative ? (
                        <Link href={`/initiatives/${a.initiativeId}/actions`} className="text-blue hover:underline">
                          {a.initiative.name}
                        </Link>
                      ) : (
                        <span className="text-ink/50">Propre à l'établissement</span>
                      )}
                    </td>
                    <td className="text-sm text-ink/60">{a.responsableActor?.name || a.responsable || "—"}</td>
                    <td className={`text-sm ${late ? "text-bad font-medium" : "text-ink/60"}`}>
                      {a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td>
                      <Pill text={a.status.replace(/_/g, " ")} tone={statusTone(a.status)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
