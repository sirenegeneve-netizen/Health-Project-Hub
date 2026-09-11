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

export default async function EstablishmentsPage() {
  const establishments = await prisma.establishment.findMany({
    include: { initiatives: { include: { initiative: true } }, group: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-ink mb-4">Établissements</h1>
      <EstablishmentForm />

      {establishments.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">
          Aucun établissement créé. Un projet ne peut être rattaché qu'à un établissement existant — créez-en un pour commencer.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {establishments.map((e) => (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="font-medium text-ink">{e.name}</div>
                {e.type && <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[e.type] || e.type}</span>}
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
                <div className="text-sm text-muted">Aucun projet rattaché</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
