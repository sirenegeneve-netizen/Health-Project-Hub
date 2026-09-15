import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Migration ponctuelle liée à l'architecture Groupe > Établissement > Initiative :
// réconcilie les anciennes valeurs de Initiative.type avec la liste cible à 10
// types (voir prisma/schema.prisma, commentaire au-dessus du champ `type`).
//
// changement_version   -> mise_a_niveau
// remplacement         -> migration        (décision explicite : un remplacement
//                                            de logiciel est traité comme une
//                                            migration)
// mise_en_conformite   -> reglementaire
// optimisation         -> evolution         (décision explicite)
// deploiement, migration, evolution, interoperabilite, autre : inchangés
//
// Idempotent : relançable sans risque (les valeurs déjà migrées ne correspondent
// à aucune clé du mapping, donc ne sont pas retouchées).

const MAPPING: Record<string, string> = {
  changement_version: "mise_a_niveau",
  remplacement: "migration",
  mise_en_conformite: "reglementaire",
  optimisation: "evolution",
};

async function main() {
  let updated = 0;
  for (const [oldType, newType] of Object.entries(MAPPING)) {
    const res = await prisma.initiative.updateMany({
      where: { type: oldType },
      data: { type: newType },
    });
    if (res.count > 0) {
      console.log(`${oldType} -> ${newType} : ${res.count} initiative(s)`);
      updated += res.count;
    }
  }
  console.log(`Migration terminée. ${updated} initiative(s) mise(s) à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
