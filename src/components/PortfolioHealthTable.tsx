import Link from "next/link";
import type { HealthLevel } from "@/lib/healthScore";

export interface HealthRow {
  id: string;
  name: string;
  progress: number | null;
  planning: HealthLevel;
  budget: HealthLevel;
  risques: HealthLevel;
  ressources: HealthLevel;
  sante: HealthLevel;
  santeLabel: string;
}

const DOT: Record<HealthLevel, string> = { vert: "bg-ok", orange: "bg-warn", rouge: "bg-bad" };

function Dot({ level }: { level: HealthLevel }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[level]}`} title={level} />;
}

export function PortfolioHealthTable({ rows }: { rows: HealthRow[] }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-1">
        <div className="font-medium text-sm">Santé du portefeuille</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-line">
            <th className="px-4 py-2.5 font-medium">Projet</th>
            <th className="px-4 py-2.5 font-medium">Avancement</th>
            <th className="px-4 py-2.5 font-medium">Planning</th>
            <th className="px-4 py-2.5 font-medium">Budget</th>
            <th className="px-4 py-2.5 font-medium">Risques</th>
            <th className="px-4 py-2.5 font-medium">Ressources</th>
            <th className="px-4 py-2.5 font-medium">Santé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/60">
              <td className="px-4 py-2.5">
                <Link href={`/projects/${r.id}`} className="font-medium text-ink hover:text-primary">
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-ink/60">{r.progress !== null ? `${r.progress} %` : "—"}</td>
              <td className="px-4 py-2.5">
                <Link href={`/projects/${r.id}/planning`}><Dot level={r.planning} /></Link>
              </td>
              <td className="px-4 py-2.5">
                <Link href={`/projects/${r.id}/budget`}><Dot level={r.budget} /></Link>
              </td>
              <td className="px-4 py-2.5">
                <Link href={`/projects/${r.id}/risks`}><Dot level={r.risques} /></Link>
              </td>
              <td className="px-4 py-2.5">
                <Link href={`/projects/${r.id}/actors`}><Dot level={r.ressources} /></Link>
              </td>
              <td className="px-4 py-2.5"><Dot level={r.sante} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
