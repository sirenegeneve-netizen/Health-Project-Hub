import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary } from "@/lib/metrics";
import { GroupTabs } from "@/components/GroupTabs";

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

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      establishments: true,
      initiatives: {
        include: {
          establishments: { include: { establishment: true } },
          actions: true,
          risks: true,
          budgetLines: true,
        },
      },
    },
  });
  if (!group) notFound();

  const scores = await Promise.all(group.initiatives.map((i) => computeHealthScore(i.id)));
  const vert = scores.filter((s) => s.level === "vert").length;
  const orange = scores.filter((s) => s.level === "orange").length;
  const rouge = scores.filter((s) => s.level === "rouge").length;

  const budgets = group.initiatives
    .map((i) => computeBudgetSummary(i.budgetInitialEur, i.budgetReviseEur, i.budgetLines))
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
  const totalReel = budgets.reduce((s, b) => s + b.reel, 0);

  const openRisks = group.initiatives.flatMap((i) => i.risks.filter((r) => !["maitrise", "cloture"].includes(r.status)));
  const now = new Date();
  const lateActions = group.initiatives.flatMap((i) => i.actions.filter((a) => a.echeance && a.echeance < now && !["termine", "abandonne"].includes(a.status)));

  const recentInitiatives = [...group.initiatives]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <div className="text-sm text-muted mb-6">
        {group.establishments.length} établissement{group.establishments.length > 1 ? "s" : ""} · {group.initiatives.length} initiative
        {group.initiatives.length > 1 ? "s" : ""}
      </div>

      <GroupTabs groupId={group.id} />

      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <Link href={`/groups/${group.id}/initiatives`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Santé du portefeuille</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ok" />{vert}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" />{orange}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bad" />{rouge}</span>
          </div>
        </Link>
        <Link href={`/groups/${group.id}/reporting`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Budget consolidé</div>
          <div className="text-sm font-medium text-ink">
            {totalBudget > 0 ? `${totalReel.toLocaleString("fr-FR")} € / ${totalBudget.toLocaleString("fr-FR")} €` : "—"}
          </div>
        </Link>
        <Link href={`/groups/${group.id}/risques`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Risques ouverts</div>
          <div className="text-sm font-medium text-ink">{openRisks.length}</div>
        </Link>
        <Link href={`/groups/${group.id}/actions`} className="card hover:border-blue transition-colors">
          <div className="text-xs text-ink/40 mb-1">Actions en retard</div>
          <div className="text-sm font-medium text-ink">{lateActions.length}</div>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-ink">Établissements</h3>
            <Link href={`/groups/${group.id}/etablissements`} className="text-xs text-blue hover:underline">
              Voir tout →
            </Link>
          </div>
          {group.establishments.length === 0 ? (
            <p className="text-sm text-ink/40">Aucun établissement.</p>
          ) : (
            <ul className="grid md:grid-cols-2 gap-2">
              {group.establishments.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/establishments/${e.id}`} className="text-sm text-blue hover:underline">
                    {e.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-ink">Initiatives récentes</h3>
            <Link href={`/groups/${group.id}/initiatives`} className="text-xs text-blue hover:underline">
              Voir le portefeuille →
            </Link>
          </div>
          {recentInitiatives.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune initiative.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentInitiatives.map((i) => {
                const idx = group.initiatives.findIndex((gi) => gi.id === i.id);
                return (
                  <li key={i.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${scores[idx].level === "vert" ? "bg-ok" : scores[idx].level === "orange" ? "bg-warn" : "bg-bad"}`} />
                      <Link href={`/initiatives/${i.id}`} className="text-blue hover:underline font-medium">
                        {i.name}
                      </Link>
                      <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[i.type] || i.type}</span>
                    </div>
                    <span className="text-ink/40 text-xs">{i.establishments.map((e) => e.establishment.name).join(", ") || "Groupe"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
