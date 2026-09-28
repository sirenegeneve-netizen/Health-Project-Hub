import Link from "next/link";
import { prisma } from "@/lib/db";
import { findCandidates } from "@/lib/chefSponsorResolve";
import { ChefSponsorResolver } from "@/components/ChefSponsorResolver";

export const dynamic = "force-dynamic";

export default async function ChefSponsorAdminPage() {
  const initiatives = await prisma.initiative.findMany({
    where: {
      OR: [
        { chefDeProjetId: null, chefDeProjet: { not: null } },
        { sponsorId: null, sponsor: { not: null } },
      ],
    },
    select: { id: true, name: true, chefDeProjet: true, chefDeProjetId: true, sponsor: true, sponsorId: true },
  });

  const allActors = await prisma.actor.findMany({ where: { actif: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const rows: {
    initiativeId: string;
    initiativeName: string;
    field: "chefDeProjetId" | "sponsorId";
    fieldLabel: string;
    valeurTexte: string;
    candidates: { id: string; name: string }[];
  }[] = [];

  for (const init of initiatives) {
    if (init.chefDeProjetId === null && init.chefDeProjet && init.chefDeProjet.trim()) {
      rows.push({
        initiativeId: init.id,
        initiativeName: init.name,
        field: "chefDeProjetId",
        fieldLabel: "Chef de projet",
        valeurTexte: init.chefDeProjet,
        candidates: findCandidates(init.chefDeProjet, allActors),
      });
    }
    if (init.sponsorId === null && init.sponsor && init.sponsor.trim()) {
      rows.push({
        initiativeId: init.id,
        initiativeName: init.name,
        field: "sponsorId",
        fieldLabel: "Sponsor",
        valeurTexte: init.sponsor,
        candidates: findCandidates(init.sponsor, allActors),
      });
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/settings" className="text-sm text-blue hover:underline">
          ← Paramètres
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">Chef de projet / Sponsor à rattacher</h1>
      <p className="text-sm text-muted mb-6">
        Reliquat de la migration vers le référentiel Acteur unique : ces initiatives ont un chef de projet ou un sponsor saisi en texte
        libre, sans Acteur rattaché (aucune correspondance automatique trouvée ou correspondance ambiguë). Le texte d'origine n'est jamais
        modifié par cette page — seul le rattachement est écrit.
      </p>

      {rows.length === 0 ? (
        <div className="card text-center text-ink/50 py-14">Aucun cas restant — tout est rattaché.</div>
      ) : (
        <ChefSponsorResolver rows={rows} allActors={allActors} />
      )}
    </div>
  );
}
