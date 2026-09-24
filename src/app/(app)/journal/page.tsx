import Link from "next/link";
import { prisma } from "@/lib/db";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<string, string> = {
  initiative: "Initiative",
  risk: "Risque",
  action: "Action",
  decision: "Décision",
  document: "Document",
  actor: "Acteur",
  establishment: "Établissement",
  group: "Groupe",
};

const ACTION_LABELS: Record<string, string> = { create: "Création", update: "Modification", delete: "Suppression" };
const ACTION_TONE: Record<string, "ok" | "neutral" | "bad"> = { create: "ok", update: "neutral", delete: "bad" };

// Seules les initiatives/groupes/établissements ont une fiche stable à lier —
// risque/action/décision/document/acteur vivent à l'intérieur d'une fiche et
// n'ont pas d'URL propre (et peuvent avoir été supprimés depuis).
function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === "initiative") return `/initiatives/${entityId}`;
  if (entityType === "group") return `/groups/${entityId}`;
  if (entityType === "establishment") return `/establishments/${entityId}`;
  return null;
}

function humanizeField(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function fmtVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("fr-FR");
  }
  return String(v);
}

export default async function JournalPage({ searchParams }: { searchParams: { entityType?: string; action?: string } }) {
  const where: Record<string, unknown> = {};
  if (searchParams.entityType) where.entityType = searchParams.entityType;
  if (searchParams.action) where.action = searchParams.action;

  const entries = await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 150 });

  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const day = e.createdAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }

  const activeEntityTypes = Object.keys(ENTITY_LABELS);

  return (
    <div>
      <PortfolioTabs />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">Journal d'activité</h1>
        <p className="text-sm text-muted">Qui a changé quoi, quand — tous objets confondus. Les 150 dernières actions.</p>
      </div>

      <form className="flex flex-wrap gap-2 mb-4 text-sm" method="get">
        <select name="entityType" defaultValue={searchParams.entityType || ""} className="rounded-lg border border-ink/10 px-2 py-1.5 bg-white">
          <option value="">Tous les types d'objet</option>
          {activeEntityTypes.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t]}
            </option>
          ))}
        </select>
        <select name="action" defaultValue={searchParams.action || ""} className="rounded-lg border border-ink/10 px-2 py-1.5 bg-white">
          <option value="">Toutes les actions</option>
          <option value="create">Création</option>
          <option value="update">Modification</option>
          <option value="delete">Suppression</option>
        </select>
        <button className="btn-secondary text-sm">Filtrer</button>
        {(searchParams.entityType || searchParams.action) && (
          <Link href="/journal" className="text-sm text-blue hover:underline self-center">
            Réinitialiser
          </Link>
        )}
      </form>

      {entries.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucune activité pour ce filtre.</div>
      ) : (
        Array.from(groups.entries()).map(([day, dayEntries]) => (
          <div key={day} className="mb-6">
            <div className="text-xs font-medium text-ink/50 uppercase tracking-wide mb-2">{day}</div>
            <div className="card p-0 divide-y divide-ink/5">
              {dayEntries.map((e) => {
                const href = entityHref(e.entityType, e.entityId);
                const changes = (e.changes as Record<string, { from: unknown; to: unknown }> | null) || null;
                return (
                  <div key={e.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center flex-wrap gap-2">
                      <Pill text={ACTION_LABELS[e.action] || e.action} tone={ACTION_TONE[e.action] || "neutral"} />
                      <span className="text-ink/50 text-xs">{ENTITY_LABELS[e.entityType] || e.entityType}</span>
                      {href ? (
                        <Link href={href} className="font-medium text-blue hover:underline">
                          {e.entityLabel}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.entityLabel}</span>
                      )}
                      <span className="text-ink/40 text-xs ml-auto whitespace-nowrap">
                        {e.userName} · {e.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {changes && Object.keys(changes).length > 0 && (
                      <ul className="mt-1.5 pl-1 space-y-0.5 text-xs text-ink/60">
                        {Object.entries(changes).map(([field, { from, to }]) => (
                          <li key={field}>
                            <span className="text-ink/40">{humanizeField(field)} :</span> {fmtVal(from)} → {fmtVal(to)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
