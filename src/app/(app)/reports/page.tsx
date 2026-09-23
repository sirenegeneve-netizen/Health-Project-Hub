import Link from "next/link";
import { prisma } from "@/lib/db";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { ReportsCharts } from "@/components/ReportsCharts";
import { computeHealthScore } from "@/lib/healthScore";
import { getScope, initiativeScopeWhere } from "@/lib/scope";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = { actif: "Actif", en_pause: "En pause", cloture: "Clôturé" };
const PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", critique: "Critique" };
const HEALTH_LABELS: Record<string, string> = { vert: "🟢 Maîtrisé", orange: "🟠 À surveiller", rouge: "🔴 À risque" };
const CRITICITE_LABELS: Record<string, string> = { faible: "Faible", moyenne: "Moyenne", forte: "Forte", critique: "Critique" };

function bucketBy<T>(items: T[], keyFn: (item: T) => string | null, itemFn: (item: T) => { id: string; name: string; sub?: string }) {
  const map = new Map<string, { id: string; name: string; sub?: string }[]>();
  for (const item of items) {
    const k = keyFn(item) || "Non renseigné";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(itemFn(item));
  }
  return Array.from(map.entries())
    .map(([label, its]) => ({ label, value: its.length, items: its }))
    .sort((a, b) => b.value - a.value);
}

export default async function ReportsPage() {
  const scope = await getScope();
  const [initiatives, risksAllRaw] = await Promise.all([
    prisma.initiative.findMany({ where: initiativeScopeWhere(scope), include: { establishments: { include: { establishment: true } } } }),
    prisma.risk.findMany({
      where: scope.establishmentId ? { initiative: initiativeScopeWhere(scope) } : undefined,
      select: { createdAt: true, criticite: true, status: true, description: true, initiativeId: true, initiative: { select: { id: true, name: true } } },
    }),
  ]);
  // Cette page reste, comme avant, centrée sur les initiatives : les risques
  // propres à un groupe ou un établissement (sans initiative) ne sont pas
  // représentés ici pour l'instant.
  const risksAll = risksAllRaw.filter((r) => r.initiative);

  if (initiatives.length === 0) {
    return (
      <div>
        <PortfolioTabs />
        <h1 className="font-display text-2xl text-ink mb-4">Rapports</h1>
        <div className="card text-center text-ink/50 py-14">Aucune initiative pour construire de statistiques.</div>
      </div>
    );
  }

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));

  const byStatus = bucketBy(
    initiatives,
    (p) => STATUS_LABELS[p.status] || p.status,
    (p) => ({ id: p.id, name: p.name })
  );
  const byPriority = bucketBy(
    initiatives,
    (p) => PRIORITY_LABELS[p.priority] || p.priority,
    (p) => ({ id: p.id, name: p.name })
  );
  const byHealth = bucketBy(
    initiatives.map((p, i) => ({ p, score: scores[i] })),
    (x) => HEALTH_LABELS[x.score.level] || x.score.level,
    (x) => ({ id: x.p.id, name: x.p.name })
  );
  const byEstablishment = bucketBy(
    initiatives.flatMap((p) => (p.establishments.length > 0 ? p.establishments.map((e) => ({ p, name: e.establishment.name })) : [{ p, name: null as string | null }])),
    (x) => x.name,
    (x) => ({ id: x.p.id, name: x.p.name })
  );
  const openRisks = risksAll.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const risksByCriticite = bucketBy(
    openRisks,
    (r) => CRITICITE_LABELS[r.criticite] || r.criticite,
    (r) => ({ id: r.initiativeId!, name: r.description, sub: r.initiative!.name })
  );

  // Tendance de création — dérivée de vraies dates de création, mois par mois.
  const now = new Date();
  const months: { label: string; value: number; items: { id: string; name: string; sub?: string }[] }[] = [];
  for (let i = 8; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const items = initiatives
      .filter((p) => p.createdAt.getFullYear() === d.getFullYear() && p.createdAt.getMonth() === d.getMonth())
      .map((p) => ({ id: p.id, name: p.name }));
    months.push({ label, value: items.length, items });
  }
  const riskMonths = months.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (8 - i), 1);
    const items = risksAll
      .filter((r) => r.createdAt.getFullYear() === d.getFullYear() && r.createdAt.getMonth() === d.getMonth())
      .map((r) => ({ id: r.initiativeId!, name: r.description, sub: r.initiative!.name }));
    return { label: m.label, value: items.length, items };
  });

  return (
    <div>
      <PortfolioTabs />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Rapports</h1>
        <p className="text-sm text-muted">
          Répartitions et tendances réelles du portefeuille — rien d'estimé ou d'extrapolé. Cliquez sur un segment ou une barre pour
          voir le détail.
          {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
        </p>
      </div>

      <ReportsCharts
        byHealth={byHealth}
        byStatus={byStatus}
        byPriority={byPriority}
        byEstablishment={byEstablishment}
        risksByCriticite={risksByCriticite}
        months={months}
        riskMonths={riskMonths}
      />

      <p className="text-xs text-muted/70 mt-6">
        L'évolution du budget consommé et la charge par ressource ne sont pas encore représentées ici : elles nécessitent un
        historique dans le temps que l'outil ne conserve pas encore (photos successives plutôt qu'un seul chiffre courant). Les
        risques/actions propres à un groupe ou un établissement (sans initiative) ne sont pas non plus repris ici.
      </p>

      <div className="card mt-6">
        <div className="font-medium text-sm mb-1">Synthèse COPIL</div>
        <p className="text-xs text-muted mb-3">Générez en un clic la synthèse d'une initiative pour préparer un comité de pilotage.</p>
        <div className="flex flex-wrap gap-2">
          {initiatives.map((p) => (
            <Link key={p.id} href={`/initiatives/${p.id}/copil`} className="text-sm px-3 py-1.5 rounded-lg bg-ink/5 text-ink/70 hover:bg-teal-50 hover:text-primary transition-colors">
              {p.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
