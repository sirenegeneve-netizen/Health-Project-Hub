import Link from "next/link";
import { prisma } from "@/lib/db";
import { EstablishmentForm } from "@/components/EstablishmentForm";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  hopital: "Hôpital",
  clinique: "Clinique",
  ehpad: "EHPAD",
  cabinet: "Cabinet",
  ght: "GHT",
  autre: "Autre",
};

export default async function EstablishmentsPage({
  searchParams,
}: {
  searchParams: { q?: string; groupe?: string; type?: string; statut?: string };
}) {
  const [establishments, groups] = await Promise.all([
    prisma.establishment.findMany({
      include: { initiatives: { include: { initiative: true } }, group: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  let filtered = establishments;
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(q) || (e.localisation || "").toLowerCase().includes(q));
  }
  if (searchParams.groupe) filtered = filtered.filter((e) => e.groupId === searchParams.groupe);
  if (searchParams.type) filtered = filtered.filter((e) => e.type === searchParams.type);
  if (searchParams.statut) filtered = filtered.filter((e) => e.status === searchParams.statut);

  const hasFilters = searchParams.q || searchParams.groupe || searchParams.type || searchParams.statut;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-4">Établissements</h1>
      <EstablishmentForm groups={groups} />

      <form className="flex flex-wrap gap-2 mb-4 text-sm" method="get">
        <input className="input" name="q" placeholder="Rechercher un établissement…" defaultValue={searchParams.q || ""} />
        <select name="groupe" defaultValue={searchParams.groupe || ""} className="input w-auto">
          <option value="">Tous les groupes</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams.type || ""} className="input w-auto">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="statut" defaultValue={searchParams.statut || ""} className="input w-auto">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
        <button type="submit" className="btn-secondary">
          Filtrer
        </button>
        {hasFilters && (
          <Link href="/establishments" className="text-xs text-blue hover:underline self-center">
            Réinitialiser
          </Link>
        )}
      </form>

      {establishments.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">
          Aucun établissement créé. Une initiative ne peut être rattachée qu'à un établissement existant — créez-en un pour commencer.
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun établissement ne correspond à ces filtres.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((e) => (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-1">
                <Link href={`/establishments/${e.id}`} className="font-medium text-ink hover:text-blue hover:underline">
                  {e.name}
                </Link>
                <div className="flex gap-1.5 shrink-0">
                  {e.status === "inactif" && <span className="text-xs bg-ink/10 text-ink/60 rounded px-2 py-0.5">Inactif</span>}
                  {e.type && <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[e.type] || e.type}</span>}
                </div>
              </div>
              <div className="text-xs text-muted mb-2">{e.localisation || "Localisation non renseignée"} · {e.group.name}</div>
              {e.initiatives.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {e.initiatives.map((pe) => (
                    <li key={pe.id}>
                      <Link href={`/initiatives/${pe.initiative.id}`} className="text-blue hover:underline">
                        {pe.initiative.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">Aucune initiative rattachée</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
