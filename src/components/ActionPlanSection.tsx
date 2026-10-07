import Link from "next/link";
import { Pill } from "@/components/Pill";
import { ActionStatusSelect, PlanActionForm } from "@/components/ActionPlanClient";

export interface PlanActionRow {
  id: string;
  title: string;
  livrable: string | null;
  priority: string;
  status: string;
  responsable: string | null;
  echeance: Date | null;
  initiativeId: string | null;
  cycle: { id: string; goalLabel: string; planLabel: string; cible: string | null; indicateurs: string | null } | null;
}

const PRIORITY_TONE: Record<string, "ok" | "warn" | "bad" | "neutral"> = { basse: "neutral", normale: "neutral", haute: "warn", critique: "bad" };
const PRIORITY_LABEL: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute", critique: "Critique" };

// Plan d'action d'un groupe ou d'un établissement : une ligne par action, avec l'objectif servi, le livrable /
// la preuve attendu, la priorité, et les indicateurs et la cible de l'objectif (jamais de valeur fabriquée :
// sans objectif lié, ces colonnes restent vides).
export function ActionPlanSection({
  ownerType,
  ownerId,
  actions,
  objectives,
  actors,
}: {
  ownerType: "groupe" | "etablissement";
  ownerId: string;
  actions: PlanActionRow[];
  objectives: { id: string; label: string }[];
  actors: { id: string; name: string }[];
}) {
  const now = Date.now();
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg text-ink mb-3">Plan d'action</h2>
      <PlanActionForm ownerType={ownerType} ownerId={ownerId} objectives={objectives} actors={actors} />
      {actions.length === 0 ? (
        <div className="card text-center text-muted py-8">Aucune action dans le plan d'action.</div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Action</th>
                <th>Objectif</th>
                <th>Livrable / preuve</th>
                <th>Priorité</th>
                <th>Indicateurs</th>
                <th>Objectif cible</th>
                <th>Responsable</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const overdue = a.echeance && a.echeance.getTime() < now && a.status !== "termine" && a.status !== "abandonne";
                return (
                  <tr key={a.id}>
                    <td className="pl-4 text-sm">
                      {a.initiativeId ? (
                        <Link href={`/initiatives/${a.initiativeId}`} className="text-blue hover:underline">
                          {a.title}
                        </Link>
                      ) : (
                        a.title
                      )}
                    </td>
                    <td className="text-sm">
                      {a.cycle ? (
                        <>
                          {a.cycle.goalLabel}
                          <div className="text-xs text-muted">{a.cycle.planLabel}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-sm">{a.livrable || <span className="text-muted">—</span>}</td>
                    <td>
                      <Pill text={PRIORITY_LABEL[a.priority] || a.priority} tone={PRIORITY_TONE[a.priority] || "neutral"} />
                    </td>
                    <td className="text-sm">{a.cycle?.indicateurs || <span className="text-muted">—</span>}</td>
                    <td className="text-sm">{a.cycle?.cible || <span className="text-muted">—</span>}</td>
                    <td className="text-sm text-muted">{a.responsable || "—"}</td>
                    <td className={`text-sm whitespace-nowrap ${overdue ? "text-bad" : "text-muted"}`}>{a.echeance ? a.echeance.toLocaleDateString("fr-FR") : "—"}</td>
                    <td>
                      <ActionStatusSelect actionId={a.id} status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
