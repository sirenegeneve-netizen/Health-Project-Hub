import { prisma } from "@/lib/db";
import { BarList } from "@/components/BarList";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = { actif: "Actif", en_pause: "En pause", cloture: "Clôturé" };
const PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", critique: "Critique" };

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
  const [projects, risks] = await Promise.all([
    prisma.project.findMany({ include: { establishments: { include: { establishment: true } } } }),
    prisma.risk.findMany({ select: { createdAt: true } }),
  ]);

  if (projects.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-4">Rapports</h1>
        <div className="card text-center text-ink/50 py-14">Aucun projet pour construire de statistiques.</div>
      </div>
    );
  }

  const byStatus = countBy(projects, (p) => STATUS_LABELS[p.status] || p.status);
  const byPriority = countBy(projects, (p) => PRIORITY_LABELS[p.priority] || p.priority);
  const byEstablishment = countBy(
    projects.flatMap((p) => (p.establishments.length > 0 ? p.establishments.map((e) => e.establishment.name) : [null])),
    (name) => name
  );

  // Tendance de création — dérivée de vraies dates de création, mois par mois.
  const now = new Date();
  const months: { label: string; value: number }[] = [];
  for (let i = 8; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const count = projects.filter((p) => p.createdAt.getFullYear() === d.getFullYear() && p.createdAt.getMonth() === d.getMonth()).length;
    months.push({ label, value: count });
  }
  const riskMonths = months.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (8 - i), 1);
    const count = risks.filter((r) => r.createdAt.getFullYear() === d.getFullYear() && r.createdAt.getMonth() === d.getMonth()).length;
    return { label: m.label, value: count };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Rapports</h1>
        <p className="text-sm text-muted">Répartitions et tendances réelles du portefeuille — rien d'estimé ou d'extrapolé.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
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
        <div className="card">
          <div className="font-medium text-sm mb-3">Projets créés par mois</div>
          <BarList data={months} />
        </div>
      </div>

      {risks.length > 0 && (
        <div className="card">
          <div className="font-medium text-sm mb-3">Risques identifiés par mois</div>
          <BarList data={riskMonths} />
        </div>
      )}

      <p className="text-xs text-muted/70 mt-6">
        L'évolution du budget consommé et la charge par ressource ne sont pas encore représentées ici : elles nécessitent un
        historique dans le temps que l'outil ne conserve pas encore (photos successives plutôt qu'un seul chiffre courant).
      </p>
    </div>
  );
}
