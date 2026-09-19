import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";

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

export default async function EstablishmentInitiativesPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: { initiatives: { include: { initiative: true }, orderBy: { initiative: { name: "asc" } } } },
  });
  if (!establishment) notFound();

  const enCours = establishment.initiatives.filter((ie) => ie.initiative.status === "actif");
  const autres = establishment.initiatives.filter((ie) => ie.initiative.status !== "actif");

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      {establishment.initiatives.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucune initiative rattachée pour l'instant.</div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-medium text-ink mb-3">En cours ({enCours.length})</h3>
            {enCours.length === 0 ? (
              <p className="text-sm text-ink/40">Aucune initiative active.</p>
            ) : (
              <ul className="space-y-1.5">
                {enCours.map((ie) => (
                  <li key={ie.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
                    <Link href={`/initiatives/${ie.initiative.id}`} className="text-blue hover:underline font-medium">
                      {ie.initiative.name}
                    </Link>
                    <span className="text-xs bg-ink/5 text-ink/70 rounded px-2 py-0.5">{TYPE_LABELS[ie.initiative.type] || ie.initiative.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {autres.length > 0 && (
            <div className="card">
              <h3 className="font-medium text-ink mb-3">Autres statuts ({autres.length})</h3>
              <ul className="space-y-1.5">
                {autres.map((ie) => (
                  <li key={ie.id} className="flex items-center justify-between text-sm border-b border-line/60 pb-1.5">
                    <Link href={`/initiatives/${ie.initiative.id}`} className="text-blue hover:underline font-medium">
                      {ie.initiative.name}
                    </Link>
                    <span className="text-xs text-ink/40">{ie.initiative.status.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
