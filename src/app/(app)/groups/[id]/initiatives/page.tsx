import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeHealthScore } from "@/lib/healthScore";
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

export default async function GroupInitiativesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { etablissement?: string; type?: string; multi?: string };
}) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      establishments: { orderBy: { name: "asc" } },
      initiatives: { include: { establishments: { include: { establishment: true } } }, orderBy: { name: "asc" } },
    },
  });
  if (!group) notFound();

  const scores = new Map(await Promise.all(group.initiatives.map(async (i) => [i.id, await computeHealthScore(i.id)] as const)));

  let initiatives = group.initiatives;
  if (searchParams.etablissement) {
    initiatives = initiatives.filter((i) => i.establishments.some((e) => e.establishmentId === searchParams.etablissement));
  }
  if (searchParams.type) {
    initiatives = initiatives.filter((i) => i.type === searchParams.type);
  }
  if (searchParams.multi === "1") {
    initiatives = initiatives.filter((i) => i.establishments.length > 1);
  }

  const typesPresents = Array.from(new Set(group.initiatives.map((i) => i.type)));

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-ink">Portefeuille d'initiatives ({initiatives.length})</h2>
        <Link href={`/groups/${group.id}/initiatives`} className="text-xs text-blue hover:underline">
          Réinitialiser les filtres
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 mb-4 text-sm" method="get">
        <select name="etablissement" defaultValue={searchParams.etablissement || ""} className="input w-auto">
          <option value="">Tous les établissements</option>
          {group.establishments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams.type || ""} className="input w-auto">
          <option value="">Tous les types</option>
          {typesPresents.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 px-2">
          <input type="checkbox" name="multi" value="1" defaultChecked={searchParams.multi === "1"} />
          Multi-établissements uniquement
        </label>
        <button type="submit" className="btn-secondary">
          Filtrer
        </button>
      </form>

      {initiatives.length === 0 ? (
        <p className="text-sm text-ink/40">Aucune initiative ne correspond à ces filtres.</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-hp">
            <thead>
              <tr className="bg-teal-50/50">
                <th className="pl-4">Initiative</th>
                <th>Type</th>
                <th>Établissement(s)</th>
                <th>Santé</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((i) => {
                const s = scores.get(i.id)!;
                return (
                  <tr key={i.id}>
                    <td className="pl-4">
                      <Link href={`/initiatives/${i.id}`} className="text-blue hover:underline font-medium">
                        {i.name}
                      </Link>
                    </td>
                    <td className="text-sm">{TYPE_LABELS[i.type] || i.type}</td>
                    <td className="text-sm text-ink/60">{i.establishments.map((e) => e.establishment.name).join(", ") || "Groupe"}</td>
                    <td>
                      <span className={`inline-block w-2 h-2 rounded-full ${s.level === "vert" ? "bg-ok" : s.level === "orange" ? "bg-warn" : "bg-bad"}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
