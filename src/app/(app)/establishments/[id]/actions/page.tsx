import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { Pill, statusTone } from "@/components/Pill";

export const dynamic = "force-dynamic";

export default async function EstablishmentActionsPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!establishment) notFound();

  const actions = await prisma.action.findMany({
    where: { establishmentId: params.id },
    include: { initiative: true, responsableActor: true },
    orderBy: [{ status: "asc" }, { echeance: "asc" }],
  });
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
        Actions des initiatives explicitement taguées pour cet établissement, {lateActions.length} en retard sur {actions.length}. Une
        action se crée toujours depuis l'initiative concernée, en la rattachant à cet établissement.
      </p>

      {actions.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune action taguée pour cet établissement.</div>
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
                      <Link href={`/initiatives/${a.initiativeId}/actions`} className="text-blue hover:underline">
                        {a.initiative.name}
                      </Link>
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
