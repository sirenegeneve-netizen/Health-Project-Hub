import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectTabs } from "@/components/ProjectTabs";
import { TrainingForm, TrainingSessionForm, KpiForm } from "@/components/EntityForms";
import { computePopulationReadiness, computeAccompagnementReadiness } from "@/lib/readiness";
import { HealthBadge } from "@/components/HealthBadge";

export const dynamic = "force-dynamic";

const AUTONOMY_LABELS = [
  "0 — Non formé",
  "1 — Formé mais accompagné",
  "2 — Autonome sur les opérations courantes",
  "3 — Autonome et capable d'aider ses collègues",
  "4 — Référent / expert",
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-ink mb-3">{children}</h2>;
}

export default async function AccompagnementPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { establishments: { include: { establishment: true } } },
  });
  if (!project) notFound();

  const [populations, sessions, adoptionKpis] = await Promise.all([
    prisma.trainingRecord.findMany({ where: { projectId: params.id }, include: { establishment: true }, orderBy: { createdAt: "desc" } }),
    prisma.trainingSession.findMany({ where: { projectId: params.id }, include: { trainingRecord: true }, orderBy: { date: "desc" } }),
    prisma.kpi.findMany({ where: { projectId: params.id, categorie: "adoption" }, orderBy: { createdAt: "desc" } }),
  ]);

  const sessionsByPopulation = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!sessionsByPopulation.has(s.trainingRecordId)) sessionsByPopulation.set(s.trainingRecordId, []);
    sessionsByPopulation.get(s.trainingRecordId)!.push(s);
  }

  const populationReadiness = populations.map((p) => computePopulationReadiness(p, sessionsByPopulation.get(p.id) || []));
  const readinessById = new Map(populationReadiness.map((r) => [r.populationId, r]));
  const overall = computeAccompagnementReadiness(populationReadiness);

  const totalUsers = populations.reduce((s, p) => s + p.nbUsers, 0);
  const totalFormed = populations.reduce((s, p) => s + p.nbFormes, 0);
  const totalAutonomous = populations.reduce((s, p) => s + (p.autonomyLevel >= 2 ? p.nbFormes : 0), 0);

  return (
    <div>
      <ProjectTabs projectId={params.id} />
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <h1 className="font-display text-2xl text-ink">Accompagnement</h1>
          <p className="text-sm text-muted">Les utilisateurs sont-ils prêts à utiliser la solution en autonomie lors du Go-Live ?</p>
        </div>
        <HealthBadge level={overall.level} label={overall.label} />
      </div>
      <ul className="text-sm text-body mt-3 mb-6 space-y-1">
        {overall.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-muted">·</span>
            {r}
          </li>
        ))}
      </ul>

      {totalUsers > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card">
            <div className="label">Population totale</div>
            <div className="font-display text-2xl mt-0.5">{totalUsers}</div>
          </div>
          <div className="card">
            <div className="label">Formés</div>
            <div className="font-display text-2xl mt-0.5">{Math.round((totalFormed / totalUsers) * 100)}%</div>
          </div>
          <div className="card">
            <div className="label">Autonomes (niveau ≥ 2)</div>
            <div className="font-display text-2xl mt-0.5">{Math.round((totalAutonomous / totalUsers) * 100)}%</div>
            <div className="text-xs text-muted mt-1">Formation réalisée ≠ autonomie acquise.</div>
          </div>
        </div>
      )}

      <section>
        <SectionTitle>Populations & référents</SectionTitle>
        <TrainingForm projectId={params.id} establishments={project.establishments.map((e) => e.establishment)} />

        {populations.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3">
            {populations.map((p) => {
              const r = readinessById.get(p.id)!;
              return (
                <div key={p.id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium text-ink">{p.profil || p.metier || "Population"}</div>
                      <div className="text-xs text-muted">
                        {p.establishment?.name} {p.service && `· ${p.service}`}
                      </div>
                    </div>
                    <HealthBadge level={r.level} label={r.label} />
                  </div>
                  <div className="text-sm text-body">
                    {p.nbFormes}/{p.nbUsers} formés · {AUTONOMY_LABELS[p.autonomyLevel]}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {p.referent ? `Référent : ${p.referent}${p.referentContact ? ` (${p.referentContact})` : ""}` : "Aucun référent nommé"}
                  </div>
                  {r.presenceRate !== null && (
                    <div className="text-xs text-muted mt-0.5">Présence moyenne : {Math.round(r.presenceRate * 100)}%</div>
                  )}
                  {r.reasons.length > 0 && r.level !== "vert" && (
                    <ul className="text-xs text-warn mt-2 space-y-0.5">
                      {r.reasons.map((reason, i) => (
                        <li key={i}>· {reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune population définie pour ce projet.</div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Sessions réalisées</SectionTitle>
        <TrainingSessionForm
          projectId={params.id}
          populations={populations.map((p) => ({ id: p.id, label: `${p.profil || p.metier || "Population"} (${p.establishment?.name || "—"})` }))}
        />
        {sessions.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Date</th>
                  <th>Population</th>
                  <th>Formateur</th>
                  <th>Format</th>
                  <th>Présence</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const rate = s.nbInscrits > 0 ? Math.round((s.nbPresents / s.nbInscrits) * 100) : null;
                  return (
                    <tr key={s.id}>
                      <td className="pl-4">{new Date(s.date).toLocaleDateString("fr-FR")}</td>
                      <td>{s.trainingRecord.profil || s.trainingRecord.metier || "—"}</td>
                      <td>{s.formateur || "—"}</td>
                      <td className="capitalize">{s.format || "—"}</td>
                      <td className={rate !== null && rate < 80 ? "text-warn" : ""}>
                        {s.nbPresents}/{s.nbInscrits} {rate !== null && `(${rate}%)`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">Aucune session réalisée pour l'instant.</div>
        )}
      </section>

      <section className="mt-10 mb-4">
        <SectionTitle>Indicateurs d'adoption</SectionTitle>
        <KpiForm projectId={params.id} defaultCategorie="adoption" />
        {adoptionKpis.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {adoptionKpis.map((k) => {
              const overThreshold = k.alertThreshold !== null && k.value >= k.alertThreshold;
              const pctOfTarget = k.target ? Math.round((k.value / k.target) * 100) : null;
              return (
                <div key={k.id} className="card">
                  <div className="label mb-1">{k.name}</div>
                  <div className={`font-display text-2xl ${overThreshold ? "text-bad" : "text-ink"}`}>
                    {k.value}
                    {k.unit && <span className="text-base text-muted ml-1">{k.unit}</span>}
                  </div>
                  {k.target !== null && (
                    <div className="text-xs text-muted mt-1">
                      Objectif : {k.target}
                      {k.unit} {pctOfTarget !== null && `(${pctOfTarget}%)`}
                    </div>
                  )}
                  {k.period && <div className="text-xs text-muted/70 mt-0.5">{k.period}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center text-ink/50 py-8">
            Aucun indicateur d'adoption défini (ex. tickets support, connexions, taux d'usage réel).
          </div>
        )}
      </section>
    </div>
  );
}
