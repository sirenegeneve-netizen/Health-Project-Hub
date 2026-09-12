import Link from "next/link";
import { prisma } from "@/lib/db";
import { BarList } from "@/components/BarList";
import { computeHealthScore } from "@/lib/healthScore";
import { getScope, initiativeScopeWhere } from "@/lib/scope";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = { actif: "Actif", en_pause: "En pause", cloture: "Clôturé" };
const PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", critique: "Critique" };
const HEALTH_LABELS: Record<string, string> = { vert: "🟢 Maîtrisé", orange: "🟠 À surveiller", rouge: "🔴 À risque" };
const CRITICITE_LABELS: Record<string, string> = { faible: "Faible", moyenne: "Moyenne", forte: "Forte", critique: "Critique" };

function countBy<T>(items: T[], key: (t: T) => string | null): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item) || "Non renseigné";
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function ReportsPage() {
  const scope = await getScope();
  const [initiatives, risksAll] = await Promise.all([
    prisma.initiative.findMany({ where: initiativeScopeWhere(scope), include: { establishments: { include: { establishment: true } } } }),
    prisma.risk.findMany({
      where: scope.establishmentId ? { initiative: initiativeScopeWhere(scope) } : undefined,
      select: { createdAt: true, criticite: true, status: true },
    }),
  ]);

  if (initiatives.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Rapports</h1>
        <div className="card text-center text-ink/50 py-14">Aucun projet pour construire de statistiques.</div>
      </div>
    );
  }

  const scores = await Promise.all(initiatives.map((p) => computeHealthScore(p.id)));

  const byStatus = countBy(initiatives, (p) => STATUS_LABELS[p.status] || p.status);
  const byPriority = countBy(initiatives, (p) => PRIORITY_LABELS[p.priority] || p.priority);
  const byHealth = countBy(scores, (s) => HEALTH_LABELS[s.level] || s.level);
  const byEstablishment = countBy(
    initiatives.flatMap((p) => (p.establishments.length > 0 ? p.establishments.map((e) => e.establishment.name) : [null])),
    (name) => name
  );
  const openRisks = risksAll.filter((r) => !["maitrise", "cloture"].includes(r.status));
  const risksByCriticite = countBy(openRisks, (r) => CRITICITE_LABELS[r.criticite] || r.criticite);

  // Tendance de création — dérivée de vraies dates de création, mois par mois.
  const now = new Date();
  const months: { label: string; value: number }[] = [];
  for (let i = 8; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const count = initiatives.filter((p) => p.createdAt.getFullYear() === d.getFullYear() && p.createdAt.getMonth() === d.getMonth()).length;
    months.push({ label, value: count });
  }
  const riskMonths = months.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (8 - i), 1);
    const count = risksAll.filter((r) => r.createdAt.getFullYear() === d.getFullYear() && r.createdAt.getMonth() === d.getMonth()).length;
    return { label: m.label, value: count };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Rapports</h1>
        <p className="text-sm text-muted">
          Répartitions et tendances réelles du portefeuille — rien d'estimé ou d'extrapolé.
          {scope.establishmentName && ` Filtré sur ${scope.establishmentName}.`}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="font-medium text-sm mb-3">Santé du portefeuille</div>
          <BarList data={byHealth} />
        </div>
        <div className="card">
          <div className="font-medium text-sm mb-3">Répartition par statut</div>
          <BarList data={byStatus} />
        </div>
        <div className="card">
          <div className="font-medium text-sm mb-3">Répartition par priorité</div>
          <BarList data={byPriority} />
        </div>
        <div className="card">
          <div className="font-medium text-sm mb-3">Répartition par établissement</div>
          <BarList data={byEstablishment} />
        </div>
        {risksByCriticite.length > 0 && (
          <div className="card">
            <div className="font-medium text-sm mb-3">Risques ouverts par criticité</div>
            <BarList data={risksByCriticite} />
          </div>
        )}
        <div className="card">
          <div className="font-medium text-sm mb-3">Projets créés par mois</div>
          <BarList data={months} />
        </div>
      </div>

      {risksAll.length > 0 && (
        <div className="card">
          <div className="font-medium text-sm mb-3">Risques identifiés par mois</div>
          <BarList data={riskMonths} />
        </div>
      )}

      <p className="text-xs text-muted/70 mt-6">
        L'évolution du budget consommé et la charge par ressource ne sont pas encore représentées ici : elles nécessitent un
        historique dans le temps que l'outil ne conserve pas encore (photos successives plutôt qu'un seul chiffre courant).
      </p>

      <div className="card mt-6">
        <div className="font-medium text-sm mb-1">Synthèse COPIL</div>
        <p className="text-xs text-muted mb-3">Générez en un clic la synthèse d'un projet pour préparer un comité de pilotage.</p>
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
