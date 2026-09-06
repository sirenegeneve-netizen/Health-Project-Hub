import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { DeliverableForm, ChangeForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const DELIVERABLE_STATUS = [
  ["a_venir", "À venir"],
  ["en_cours", "En cours"],
  ["valide", "Validé"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

const CHANGE_DECISION = [
  ["en_etude", "En étude"],
  ["accepte", "Accepté"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function ConceptionPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const [deliverables, changes] = await Promise.all([
    prisma.deliverable.findMany({ where: { projectId: params.id }, orderBy: { datePrevue: "asc" } }),
    prisma.changeRequest.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="mb-1">
        <h1 className="font-display text-2xl text-ink">Conception & Préparation</h1>
        <p className="text-sm text-muted">Le projet est-il prêt à passer en réalisation ?</p>
      </div>

      <section className="mt-8">
        <SectionTitle>Livrables</SectionTitle>
        <DeliverableForm projectId={params.id} />
        {deliverables.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Livrable</th>
                  <th>Responsable</th>
                  <th>Version</th>
                  <th>Date prévue</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d) => (
                  <tr key={d.id}>
                    <td className="pl-4 font-medium">{d.name}</td>
                    <td>{d.responsable || "—"}</td>
                    <td>{d.version || "—"}</td>
                    <td>{d.datePrevue ? new Date(d.datePrevue).toLocaleDateString("fr-FR") : "—"}</td>
                    <td>
                      <InlineSelect endpoint={`/api/deliverables/${d.id}`} field="status" value={d.status} options={DELIVERABLE_STATUS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucun livrable identifié pour ce projet.</div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <SectionTitle>Changements</SectionTitle>
        <p className="text-xs text-muted mb-3">
          Un changement accepté avec une nouvelle date cible crée automatiquement une nouvelle baseline planning.
        </p>
        <ChangeForm projectId={params.id} />
        {changes.length > 0 ? (
          <div className="space-y-3">
            {changes.map((c) => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="font-medium text-ink">{c.titre}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {c.demandeur && `Demandé par ${c.demandeur}`} {c.origine && `· ${c.origine}`}
                    </div>
                  </div>
                  <InlineSelect endpoint={`/api/changes/${c.id}`} field="decision" value={c.decision} options={CHANGE_DECISION} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.perimetre && <Pill text={`Périmètre : ${c.perimetre}`} />}
                  {c.impactPlanningJours !== null && (
                    <Pill text={`Planning : ${c.impactPlanningJours! > 0 ? "+" : ""}${c.impactPlanningJours} j`} tone={c.impactPlanningJours! > 0 ? "warn" : "neutral"} />
                  )}
                  {c.impactJh !== null && <Pill text={`JH : ${c.impactJh! > 0 ? "+" : ""}${c.impactJh}`} />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune demande de changement pour ce projet.</div>
        )}
      </section>

      <p className="text-xs text-muted/70 mt-6">
        Le suivi détaillé des exigences, des écarts et de la validation des choix n'est pas encore modélisé dans l'outil — à
        prévoir dans une prochaine évolution.
      </p>
    </div>
  );
}
