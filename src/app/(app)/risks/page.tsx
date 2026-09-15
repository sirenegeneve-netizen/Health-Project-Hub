import Link from "next/link";
import { prisma } from "@/lib/db";
import { InlineSelect } from "@/components/InlineSelect";
import { RiskMatrix } from "@/components/RiskMatrix";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { getScope, initiativeScopeWhere } from "@/lib/scope";
import { computeHealthScore } from "@/lib/healthScore";
import { severityFor, reasonHref, ALERT_STYLES, computeAdditionalAlerts, type PortfolioAlert } from "@/lib/portfolioAlerts";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["ouvert", "Ouvert"],
  ["en_traitement", "En traitement"],
  ["maitrise", "Maîtrisé"],
  ["cloture", "Clôturé"],
].map(([value, label]) => ({ value, label }));

export default async function GlobalRisksPage() {
  const scope = await getScope();

  const initiatives = await prisma.initiative.findMany({
    where: initiativeScopeWhere(scope),
    select: {
      id: true,
      name: true,
      targetDate: true,
      actions: { select: { id: true, title: true, status: true, responsableActorId: true } },
      deliverables: { select: { id: true, name: true, status: true, datePrevue: true } },
      meetings: { select: { id: true, title: true, date: true, meetingParticipants: { select: { actor: { select: { id: true, name: true } } } } } },
      relationsSource: { select: { type: true, initiativeCible: { select: { id: true, name: true, targetDate: true } } } },
    },
  });

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));
  const healthAlerts: PortfolioAlert[] = initiatives.flatMap((p, i) => {
    const score = scores[i];
    if (score.level === "vert") return [];
    return score.reasons
      .filter((r) => !r.toLowerCase().startsWith("autonomie") && !r.toLowerCase().startsWith("aucun"))
      .map((reason) => ({
        level: severityFor(reason, score.level),
        message: reason,
        initiativeId: p.id,
        initiativeName: p.name,
        href: reasonHref(p.id, reason),
      }));
  });

  const additionalAlerts = computeAdditionalAlerts(initiatives);
  const allAlerts = [...healthAlerts, ...additionalAlerts].sort((a, b) => {
    const order: Record<string, number> = { critique: 0, attention: 1, info: 2 };
    return order[a.level] - order[b.level];
  });
  const criticalCount = allAlerts.filter((a) => a.level === "critique").length;

  const risks = await prisma.risk.findMany({
    where: { initiativeId: { in: initiatives.map((p) => p.id) } },
    include: { initiative: true },
    orderBy: { createdAt: "desc" },
  });
  const critical = risks.filter((r) => ["forte", "critique"].includes(r.criticite) && !["maitrise", "cloture"].includes(r.status));

  return (
    <div>
      <PortfolioTabs />
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Risques & alertes</h1>
          <p className="text-sm text-muted">
            Vue consolidée des risques et des incohérences détectées automatiquement.
            {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
          </p>
        </div>
        {criticalCount > 0 && <span className="text-sm text-bad font-medium">{criticalCount} alerte(s) critique(s)</span>}
      </div>

      <div className="card mb-6">
        <div className="font-medium text-sm mb-3">Alertes</div>
        {allAlerts.length === 0 ? (
          <p className="text-sm text-ink/40">Aucune alerte sur ce périmètre.</p>
        ) : (
          <ul className="space-y-2.5 max-h-[420px] overflow-y-auto">
            {allAlerts.map((a, i) => {
              const style = ALERT_STYLES[a.level];
              return (
                <li key={i} className="flex items-start justify-between gap-3 text-sm border-b border-line/60 last:border-0 pb-2.5 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/initiatives/${a.initiativeId}`} className="text-blue hover:underline">
                      {a.initiativeName}
                    </Link>
                    <div className="text-ink/60">
                      <Link href={a.href} className="hover:underline hover:text-ink">
                        {a.message}
                      </Link>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${style.cls}`}>{style.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {risks.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun risque identifié pour l'instant.</div>
      ) : (
        <>
          <div className="flex items-end justify-between mb-4">
            <div className="font-medium text-sm">Registre des risques</div>
            {critical.length > 0 && <span className="text-sm text-bad">{critical.length} critique(s) ouvert(s)</span>}
          </div>

          <RiskMatrix risks={risks} />

          <div className="card p-0 overflow-hidden">
            <table className="table-hp">
              <thead>
                <tr className="bg-teal-50/50">
                  <th className="pl-4">Description</th>
                  <th>Initiative</th>
                  <th>Criticité</th>
                  <th>Propriétaire</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td className="pl-4">{r.description}</td>
                    <td>
                      <Link href={`/initiatives/${r.initiativeId}`} className="text-blue hover:underline">
                        {r.initiative.name}
                      </Link>
                    </td>
                    <td className="capitalize">{r.criticite}</td>
                    <td>{r.proprietaire || "—"}</td>
                    <td>
                      <InlineSelect endpoint={`/api/risks/${r.id}`} field="status" value={r.status} options={STATUS_OPTIONS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
