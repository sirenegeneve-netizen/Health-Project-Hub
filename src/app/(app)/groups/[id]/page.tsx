import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
import { computeBudgetSummary } from "@/lib/metrics";
import { detectResourceConflicts, detectScheduleConflicts } from "@/lib/portfolioConflicts";
import { GroupContacts } from "@/components/GroupContacts";

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
      actorAffiliations: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      initiatives: {
        include: {
          establishments: { include: { establishment: true } },
          actions: true,
          risks: true,
          interfaces: true,
          deliverables: true,
          actors: true,
          raciEntries: true,
          budgetLines: true,
          relationsSource: true,
          relationsCible: true,
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
  const multiEstablishmentInitiatives = group.initiatives.filter((i) => i.establishments.length > 1);
  const relationsCount = group.initiatives.reduce((s, i) => s + i.relationsSource.length, 0);

  const scheduleConflicts = detectScheduleConflicts(
    group.initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      targetDate: p.targetDate,
      establishments: p.establishments.map((e) => e.establishment),
    }))
  );
  const resourceConflicts = detectResourceConflicts(
    group.initiatives.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      actors: p.actors,
      workloadInputs: { actions: p.actions, risks: p.risks, interfaces: p.interfaces, deliverables: p.deliverables },
      raciEntries: p.raciEntries,
    }))
  );

  const existingActors = await prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] });

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

      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Santé du portefeuille</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ok" />{vert}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn" />{orange}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bad" />{rouge}</span>
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Budget consolidé</div>
          <div className="text-sm font-medium text-ink">
            {totalBudget > 0 ? `${totalReel.toLocaleString("fr-FR")} € / ${totalBudget.toLocaleString("fr-FR")} €` : "—"}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Risques ouverts</div>
          <div className="text-sm font-medium text-ink">{openRisks.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Actions en retard</div>
          <div className="text-sm font-medium text-ink">{lateActions.length}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Initiatives multi-établissements</div>
          <div className="text-sm font-medium text-ink">{multiEstablishmentInitiatives.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-ink/40 mb-1">Relations déclarées entre initiatives</div>
          <div className="text-sm font-medium text-ink">{relationsCount}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h3 className="font-medium text-ink mb-3">Établissements</h3>
          {group.establishments.length === 0 ? (
            <p className="text-sm text-ink/40">Aucun établissement.</p>
          ) : (
            <ul className="grid md:grid-cols-2 gap-2">
              {group.establishments.map((e) => (
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
          <h3 className="font-medium text-ink mb-3">Portefeuille d'initiatives</h3>
          {group.initiatives.length === 0 ? (
            <p className="text-sm text-ink/40">Aucune initiative.</p>
          ) : (
            <ul className="space-y-1.5">
              {group.initiatives.map((i, idx) => (
                <li key={i.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${scores[idx].level === "vert" ? "bg-ok" : scores[idx].level === "orange" ? "bg-warn" : "bg-bad"}`} />
                    <Link href={`/initiatives/${i.id}`} className="text-blue hover:underline font-medium">
                      {i.name}
                    </Link>
                    <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[i.type] || i.type}</span>
                  </div>
                  <span className="text-ink/40 text-xs">{i.establishments.map((e) => e.establishment.name).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(scheduleConflicts.length > 0 || resourceConflicts.length > 0) && (
          <div className="card">
            <h3 className="font-medium text-ink mb-3">Interactions entre initiatives</h3>
            {scheduleConflicts.map((c, i) => (
              <div key={`sc-${i}`} className="text-sm border-b border-line/60 pb-1.5 mb-1.5">
                <span className="text-xs bg-bad/10 text-bad rounded px-2 py-0.5 mr-2">Conflit planning · {c.establishmentName}</span>
                {c.initiatives.map((ci, j) => (
                  <span key={ci.id}>
                    {j > 0 && " ↔ "}
                    <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                      {ci.name}
                    </Link>
                  </span>
                ))}
              </div>
            ))}
            {resourceConflicts.map((c, i) => (
              <div key={`rc-${i}`} className="text-sm border-b border-line/60 pb-1.5 mb-1.5">
                <span className={`text-xs rounded px-2 py-0.5 mr-2 ${c.level === "rouge" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn"}`}>
                  Ressource · {c.name}
                </span>
                {c.initiatives.map((ci, j) => (
                  <span key={ci.id}>
                    {j > 0 && ", "}
                    <Link href={`/initiatives/${ci.id}`} className="text-blue hover:underline">
                      {ci.name}
                    </Link>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <GroupContacts groupId={group.id} affiliations={group.actorAffiliations} existingActors={existingActors} />
      </div>
    </div>
  );
}
