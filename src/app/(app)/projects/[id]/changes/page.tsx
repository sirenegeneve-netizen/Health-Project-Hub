import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ChangeForm } from "@/components/EntityForms";
import { InlineSelect } from "@/components/InlineSelect";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const DECISION_OPTIONS = [
  ["en_etude", "En étude"],
  ["accepte", "Accepté"],
  ["rejete", "Rejeté"],
].map(([value, label]) => ({ value, label }));

export default async function ChangesPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const changes = await prisma.changeRequest.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <h1 className="font-display text-2xl text-ink mb-1">Registre des changements</h1>
      <p className="text-sm text-muted mb-4">
        Un changement accepté avec une nouvelle date cible crée automatiquement une nouvelle baseline planning — l'historique initial reste consultable dans l'onglet Planning.
      </p>
      <ChangeForm projectId={params.id} />

      {changes.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune demande de changement pour ce projet.</div>
      ) : (
        <div className="space-y-3">
          {changes.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="font-medium text-ink">{c.titre}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {c.demandeur && `Demandé par ${c.demandeur}`} {c.origine && `· ${c.origine}`}
                  </div>
                </div>
                <InlineSelect endpoint={`/api/changes/${c.id}`} field="decision" value={c.decision} options={DECISION_OPTIONS} />
              </div>

              {c.justification && <div className="text-sm text-body mb-2">{c.justification}</div>}

              <div className="flex flex-wrap gap-2">
                {c.perimetre && <Pill text={`Périmètre : ${c.perimetre}`} />}
                {c.impactFonctionnel && <Pill text={`Fonctionnel : ${c.impactFonctionnel}`} />}
                {c.impactPlanningJours !== null && (
                  <Pill text={`Planning : ${c.impactPlanningJours! > 0 ? "+" : ""}${c.impactPlanningJours} j`} tone={c.impactPlanningJours! > 0 ? "warn" : "neutral"} />
                )}
                {c.impactJh !== null && <Pill text={`JH : ${c.impactJh! > 0 ? "+" : ""}${c.impactJh}`} />}
                {c.impactInterop && <Pill text={`Interop : ${c.impactInterop}`} />}
                {c.impactFormation && <Pill text={`Formation : ${c.impactFormation}`} />}
                {c.impactRisque && <Pill text={`Risque : ${c.impactRisque}`} tone="bad" />}
                {c.nouvelleDateCible && (
                  <Pill text={`Nouvelle cible : ${new Date(c.nouvelleDateCible).toLocaleDateString("fr-FR")}`} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
