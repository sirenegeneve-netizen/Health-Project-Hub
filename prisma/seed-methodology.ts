import { PrismaClient } from "@prisma/client";
import { METHODOLOGY_GUIDES } from "../src/lib/methodologySeedData";

const prisma = new PrismaClient();

// Idempotent : upsert du guide par initiativeType, puis les items typiques sont
// entièrement remplacés à chaque exécution (delete + recreate) pour rester le
// reflet exact de methodologySeedData.ts. Relançable sans risque.

async function main() {
  let totalItems = 0;
  for (const [initiativeType, seed] of Object.entries(METHODOLOGY_GUIDES)) {
    const guide = await prisma.methodologyGuide.upsert({
      where: { initiativeType },
      create: {
        initiativeType,
        finalite: seed.finalite,
        declencheurs: seed.declencheurs,
        prerequis: seed.prerequis,
        referentiels: seed.referentiels,
      },
      update: {
        finalite: seed.finalite,
        declencheurs: seed.declencheurs,
        prerequis: seed.prerequis,
        referentiels: seed.referentiels,
      },
    });

    await prisma.methodologyTemplateItem.deleteMany({ where: { guideId: guide.id } });
    await prisma.methodologyTemplateItem.createMany({
      data: seed.items.map((item, i) => ({ guideId: guide.id, ordre: i, ...item })),
    });
    totalItems += seed.items.length;

    await prisma.methodologyRelatedType.deleteMany({ where: { guideId: guide.id } });
    if (seed.relatedTypes && seed.relatedTypes.length > 0) {
      await prisma.methodologyRelatedType.createMany({
        data: seed.relatedTypes.map((rt, i) => ({ guideId: guide.id, ordre: i, ...rt })),
      });
    }

    console.log(`${initiativeType} : guide + ${seed.items.length} élément(s) typique(s)`);
  }
  console.log(`Terminé. ${Object.keys(METHODOLOGY_GUIDES).length} guide(s), ${totalItems} élément(s) au total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
