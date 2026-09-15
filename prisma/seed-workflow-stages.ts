import { PrismaClient } from "@prisma/client";
import { WORKFLOWS } from "../src/lib/workflowSeedData";

const prisma = new PrismaClient();

// Idempotent : upsert sur (initiativeType, key), relançable sans risque.
// Les données des 10 séquences vivent dans src/lib/workflowSeedData.ts,
// partagées avec la route admin /api/admin/seed-workflow-stages.

async function main() {
  let count = 0;
  for (const [initiativeType, stages] of Object.entries(WORKFLOWS)) {
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.workflowStage.upsert({
        where: { initiativeType_key: { initiativeType, key: s.key } },
        create: { initiativeType, ordre: i, key: s.key, label: s.label, legacyPhases: s.legacyPhases || [] },
        update: { ordre: i, label: s.label, legacyPhases: s.legacyPhases || [] },
      });
      count++;
    }
    console.log(`${initiativeType} : ${stages.length} étape(s) seedée(s)`);
  }
  console.log(`Terminé. ${count} étape(s) au total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
