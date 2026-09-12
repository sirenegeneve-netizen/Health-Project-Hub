import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findInitiativeActors } from "@/lib/actorScope";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { RiskForm, ActionForm } from "@/components/EntityForms";
import { RiskMatrix } from "@/components/RiskMatrix";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["ouvert", "Ouvert"],
  ["en_traitement", "En traitement"],
  ["maitrise", "Maîtrisé"],
  ["cloture", "Clôturé"],
].map(([value, label]) => ({ value, label }));

export default async function RisksPage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { establishment: true } } },
  });
  if (!initiative) notFound();
  const risks = await prisma.risk.findMany({
    where: { initiativeId: params.id },
    include: { actions: { orderBy: { createdAt: "desc" } }, proprietaireActor: true },
    orderBy: { createdAt: "desc" },
  });
  const actors = await findInitiativeActors(params.id, { id: true, name: true });
  const establishments = initiative.establishments.map((e) => ({ id: e.establishmentId, name: e.establishment.name }));

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-4">Risques</h1>
      <RiskForm initiativeId={params.id} actors={actors} establishments={establishments} />
      <RiskMatrix risks={risks} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Description</th>
              <th>Propriétaire</th>
              <th>Criticité</th>
              <th>Plan d'action</th>
              <th>Actions liées</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id}>
                <td className="pl-4">
                  {r.description}
                  {r.cause && <div className="text-xs text-ink/50">Cause : {r.cause}</div>}
                </td>
                <td>{r.proprietaireActor?.name || r.proprietaire || "—"}</td>
                <td>
                  <Pill text={r.criticite} tone={["forte", "critique"].includes(r.criticite) ? "bad" : "neutral"} />
                </td>
                <td className="text-sm">{r.planAction || "—"}</td>
                <td className="text-xs min-w-[180px]">
                  {r.actions.length > 0 && (
                    <ul className="space-y-1 mb-1.5">
                      {r.actions.map((a) => (
                        <li key={a.id} className="text-ink/70">
                          {a.title} <span className="text-ink/40">— {a.status.replace(/_/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ActionForm initiativeId={params.id} riskId={r.id} actors={actors} label="+ Action liée" />
                </td>
                <td>
                  <InlineSelect endpoint={`/api/risks/${r.id}`} field="status" value={r.status} options={STATUS_OPTIONS} />
                </td>
              </tr>
            ))}
            {risks.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink/50">
                  Aucun risque identifié pour ce projet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
