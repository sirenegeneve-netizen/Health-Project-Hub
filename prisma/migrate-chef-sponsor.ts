import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Migration prudente et traçable : rattache Initiative.chefDeProjetId /
// sponsorId à un Acteur existant, à partir des champs texte legacy
// chefDeProjet / sponsor. Ne crée JAMAIS d'Acteur.
//
// - Correspondance EXACTE (nom normalisé identique) avec un seul Acteur de
//   l'initiative -> rattachement automatique.
// - Correspondance AMBIGUË (plusieurs Acteurs exacts) ou POTENTIELLE (fuzzy,
//   pas de match exact) -> pas de rattachement, liste "À valider".
// - Aucune correspondance -> pas de rattachement, liste "À valider".
//
// Idempotent : ignore les Initiative dont le champ *Id cible est déjà
// renseigné. Les champs texte chefDeProjet/sponsor ne sont jamais modifiés
// ni supprimés par ce script.
//
// Usage : npx tsx prisma/migrate-chef-sponsor.ts
//   (ou route admin équivalente à exposer plus tard si besoin, sur le même
//   modèle que /api/admin/seed-methodology)

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // ignore les accents

// Distance de Levenshtein simple, suffisante pour du fuzzy matching de noms courts.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

// Seuil de similarité "potentielle" : distance <= 2 pour des noms de longueur
// raisonnable, ou l'un des noms est inclus dans l'autre (ex. "J. Dupont" /
// "Jean Dupont").
function isFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return false; // déjà traité comme exact
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levenshtein(a, b) <= 2;
}

type Categorie = "auto" | "ambigu_potentiel" | "sans_correspondance";

type LigneRapport = {
  categorie: Categorie;
  initiativeId: string;
  initiativeName: string;
  champ: "chefDeProjet" | "sponsor";
  valeurTexte: string;
  acteurRattacheId?: string;
  acteurRattacheNom?: string;
  candidats?: { id: string; nom: string; type: "exact_multiple" | "fuzzy" }[];
};

async function resoudre(
  initiativeId: string,
  initiativeName: string,
  champ: "chefDeProjet" | "sponsor",
  valeurTexte: string,
  acteursInitiative: { id: string; name: string }[]
): Promise<LigneRapport> {
  const cible = norm(valeurTexte);
  const exacts = acteursInitiative.filter((a) => norm(a.name) === cible);

  if (exacts.length === 1) {
    return {
      categorie: "auto",
      initiativeId,
      initiativeName,
      champ,
      valeurTexte,
      acteurRattacheId: exacts[0].id,
      acteurRattacheNom: exacts[0].name,
    };
  }

  if (exacts.length > 1) {
    return {
      categorie: "ambigu_potentiel",
      initiativeId,
      initiativeName,
      champ,
      valeurTexte,
      candidats: exacts.map((a) => ({ id: a.id, nom: a.name, type: "exact_multiple" as const })),
    };
  }

  const fuzzy = acteursInitiative.filter((a) => isFuzzyMatch(cible, norm(a.name)));
  if (fuzzy.length > 0) {
    return {
      categorie: "ambigu_potentiel",
      initiativeId,
      initiativeName,
      champ,
      valeurTexte,
      candidats: fuzzy.map((a) => ({ id: a.id, nom: a.name, type: "fuzzy" as const })),
    };
  }

  return { categorie: "sans_correspondance", initiativeId, initiativeName, champ, valeurTexte };
}

async function main() {
  const initiatives = await prisma.initiative.findMany({
    where: {
      OR: [
        { chefDeProjetId: null, chefDeProjet: { not: null } },
        { sponsorId: null, sponsor: { not: null } },
      ],
    },
    select: { id: true, name: true, chefDeProjet: true, chefDeProjetId: true, sponsor: true, sponsorId: true },
  });

  const rapport: LigneRapport[] = [];
  let autoAppliques = 0;

  for (const init of initiatives) {
    const acteurs = await prisma.actor.findMany({
      where: { initiativeId: init.id },
      select: { id: true, name: true },
    });

    if (init.chefDeProjetId === null && init.chefDeProjet && init.chefDeProjet.trim()) {
      const ligne = await resoudre(init.id, init.name, "chefDeProjet", init.chefDeProjet, acteurs);
      rapport.push(ligne);
      if (ligne.categorie === "auto" && ligne.acteurRattacheId) {
        await prisma.initiative.update({ where: { id: init.id }, data: { chefDeProjetId: ligne.acteurRattacheId } });
        autoAppliques++;
      }
    }

    if (init.sponsorId === null && init.sponsor && init.sponsor.trim()) {
      const ligne = await resoudre(init.id, init.name, "sponsor", init.sponsor, acteurs);
      rapport.push(ligne);
      if (ligne.categorie === "auto" && ligne.acteurRattacheId) {
        await prisma.initiative.update({ where: { id: init.id }, data: { sponsorId: ligne.acteurRattacheId } });
        autoAppliques++;
      }
    }
  }

  const auto = rapport.filter((r) => r.categorie === "auto");
  const ambigus = rapport.filter((r) => r.categorie === "ambigu_potentiel");
  const sansMatch = rapport.filter((r) => r.categorie === "sans_correspondance");

  console.log("\n=== RAPPORT DE MIGRATION chefDeProjet/sponsor → Acteur ===\n");

  console.log(`1) Correspondances automatiques certaines : ${auto.length}`);
  for (const r of auto) {
    console.log(`   - [${r.initiativeName}] ${r.champ} "${r.valeurTexte}" → Acteur "${r.acteurRattacheNom}" (${r.acteurRattacheId})`);
  }

  console.log(`\n2) Correspondances ambiguës / potentielles (À VALIDER) : ${ambigus.length}`);
  for (const r of ambigus) {
    console.log(`   - [${r.initiativeName}] ${r.champ} "${r.valeurTexte}" — candidats :`);
    for (const c of r.candidats || []) {
      console.log(`       • ${c.nom} (${c.id}) [${c.type === "exact_multiple" ? "nom identique, plusieurs acteurs" : "nom proche"}]`);
    }
  }

  console.log(`\n3) Aucune correspondance (À VALIDER) : ${sansMatch.length}`);
  for (const r of sansMatch) {
    console.log(`   - [${r.initiativeName}] ${r.champ} "${r.valeurTexte}"`);
  }

  console.log(`\n${autoAppliques} rattachement(s) automatique(s) appliqué(s) en base.`);
  console.log("Les champs texte legacy n'ont pas été modifiés. Aucun Acteur n'a été créé automatiquement.");
  console.log("=== FIN DU RAPPORT ===\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
