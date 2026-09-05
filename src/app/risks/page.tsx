import Link from "next/link";
import { prisma } from "@/lib/db";
import { InlineSelect } from "@/components/InlineSelect";
import { RiskMatrix } from "@/components/RiskMatrix";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  ["ouvert", "Ouvert"],
  ["en_traitement", "En traitement"],
  ["maitrise", "Maîtrisé"],
  ["cloture", "Clôturé"],
].map(([value, label]) => ({ value, label }));

export default async function GlobalRisksPage() {
  const risks = await prisma.risk.findMany({ include: { project: true }, orderBy: { createdAt: "desc" } });

  if (risks.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl text-teal-700 mb-4">Risques</h1>
        <div className="card text-center text-ink/50 py-14">Aucun risque identifié pour l'instant.</div>
      </div>
    );
  }

  const critical = risks.filter((r) => ["forte", "critique"].includes(r.criticite) && !["maitrise", "cloture"].includes(r.status));

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-2xl text-teal-700">Risques</h1>
        {critical.length > 0 && <span className="text-sm text-bad">{critical.length} critique(s) ouvert(s)</span>}
      </div>

      <RiskMatrix risks={risks} />

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Description</th>
              <th>Projet</th>
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
                  <Link href={`/projects/${r.projectId}`} className="text-teal-700 hover:underline">
                    {r.project.name}
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
    </div>
  );
}
