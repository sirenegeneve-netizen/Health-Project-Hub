import { PrismaClient } from "@prisma/client";
import { seedTemplateEngine, migrateExistingInitiatives } from "../src/lib/templateEngine";

// Équivalent en ligne de commande de /api/admin/migrate-project-templates.
//   npm run db:seed-project-templates              seed + migration des initiatives
//   npm run db:seed-project-templates -- --dry-run simulation de la migration (n'écrit rien)
// Idempotent : relançable sans risque, ne supprime ni ne modifie aucune donnée existante.
const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) {
    const seed = await seedTemplateEngine(prisma);
    console.log("Seed :", seed);
  }
  const migration = await migrateExistingInitiatives({ dryRun });
  console.log("Migration :", { ...migration, phaseUnresolved: migration.phaseUnresolved.length });
  if (migration.phaseUnresolved.length > 0) console.log("Phases non résolues :", migration.phaseUnresolved);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
