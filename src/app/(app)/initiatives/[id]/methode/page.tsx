import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { InitiativeTabsServer as InitiativeTabs } from "@/components/InitiativeTabsServer";
import { Pill } from "@/components/Pill";
import { MethodologyQuickAdd } from "@/components/MethodologyQuickAdd";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  deploiement: "Déploiement",
  evolution: "Évolution",
  interoperabilite: "Interopérabilité",
  migration: "Migration",
  mise_a_niveau: "Mise à niveau",
  cybersecurite: "Cybersécurité",
  reglementaire: "Réglementaire",
  formation: "Formation",
  audit: "Audit",
  autre: "Autre",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

export default async function MethodePage({ params }: { params: { id: string } }) {
  const initiative = await prisma.initiative.findUnique({ where: { id: params.id } });
  if (!initiative) notFound();

  const [guide, risks, deliverables] = await Promise.all([
    prisma.methodologyGuide.findUnique({
      where: { initiativeType: initiative.type },
      include: { items: { orderBy: { ordre: "asc" } } },
    }),
    prisma.risk.findMany({ where: { initiativeId: params.id }, select: { description: true } }),
    prisma.deliverable.findMany({ where: { initiativeId: params.id }, select: { name: true } }),
  ]);

  const existingRiskLabels = new Set(risks.map((r) => norm(r.description)));
  const existingDeliverableLabels = new Set(deliverables.map((d) => norm(d.name)));

  const riskItems = guide?.items.filter((i) => i.kind === "risque") || [];
  const deliverableItems = guide?.items.filter((i) => i.kind === "livrable") || [];
  const kpiItems = guide?.items.filter((i) => i.kind === "kpi") || [];

  return (
    <div>
      <InitiativeTabs initiativeId={params.id} />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Méthode</h1>
        <p className="text-sm text-muted">Ce que ce type de projet ({TYPE_LABELS[initiative.type] || initiative.type}) implique généralement.</p>
      </div>

      {!guide ? (
        <div className="card text-center text-ink/50 py-8">
          Aucun socle méthodologique n'est encore chargé pour ce type de projet. Il doit être seedé côté administration.
        </div>
      ) : (
        <>
          {guide.referentiels.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {guide.referentiels.map((r) => (
                <Pill key={r} text={r} />
              ))}
            </div>
          )}

          {guide.finalite && (
            <section className="mb-8">
              <SectionTitle>Finalité</SectionTitle>
              <p className="text-sm text-body">{guide.finalite}</p>
            </section>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {guide.declencheurs && (
              <section>
                <SectionTitle>Déclencheurs typiques</SectionTitle>
                <p className="text-sm text-body">{guide.declencheurs}</p>
              </section>
            )}
            {guide.prerequis && (
              <section>
                <SectionTitle>Prérequis</SectionTitle>
                <p className="text-sm text-body">{guide.prerequis}</p>
              </section>
            )}
          </div>

          {riskItems.length > 0 && (
            <section className="mt-10">
              <SectionTitle>Risques typiques</SectionTitle>
              <div className="card p-0 overflow-hidden">
                <table className="table-hp">
                  <tbody>
                    {riskItems.map((i) => {
                      const already = existingRiskLabels.has(norm(i.label));
                      return (
                        <tr key={i.id}>
                          <td className="pl-4 py-2 text-sm">{i.label}</td>
                          <td className="text-right pr-4">
                            {already ? (
                              <span className="text-xs text-primary">Déjà au registre ✓</span>
                            ) : (
                              <MethodologyQuickAdd
                                initiativeId={params.id}
                                kind="risque"
                                label={i.label}
                                description={i.description}
                                probabilite={i.probabilite}
                                impact={i.impact}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {deliverableItems.length > 0 && (
            <section className="mt-10">
              <SectionTitle>Livrables typiques</SectionTitle>
              <div className="card p-0 overflow-hidden">
                <table className="table-hp">
                  <tbody>
                    {deliverableItems.map((i) => {
                      const already = existingDeliverableLabels.has(norm(i.label));
                      return (
                        <tr key={i.id}>
                          <td className="pl-4 py-2 text-sm">{i.label}</td>
                          <td className="text-right pr-4">
                            {already ? (
                              <span className="text-xs text-primary">Déjà prévu ✓</span>
                            ) : (
                              <MethodologyQuickAdd initiativeId={params.id} kind="livrable" label={i.label} description={i.description} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {kpiItems.length > 0 && (
            <section className="mt-10 mb-4">
              <SectionTitle>Indicateurs à envisager</SectionTitle>
              <p className="text-xs text-ink/50 mb-2">
                Ces indicateurs ne sont pas créés automatiquement : un KPI n'a de sens qu'avec une valeur réellement mesurée.
              </p>
              <div className="flex flex-wrap gap-2">
                {kpiItems.map((i) => (
                  <Pill key={i.id} text={i.unit ? `${i.label} (${i.unit})` : i.label} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
