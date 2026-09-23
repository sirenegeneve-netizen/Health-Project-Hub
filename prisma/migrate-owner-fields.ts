import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Migration idempotente : backfill ownerType/ownerId sur Risk, Action, Decision
// et DocumentRef, dans le cadre du lot "owner + visibilité". Avant ce lot, ces
// objets étaient toujours rattachés à une Initiative (initiativeId obligatoire) :
// tous les enregistrements existants sont donc à 100% du cas "initiative", sans
// ambiguïté possible (contrairement à la migration chefDeProjet/sponsor→Acteur).
//
// Ne touche que les lignes où ownerId est encore vide. Ne modifie jamais
// initiativeId. Sûr à relancer plusieurs fois.
//
// Usage : npx tsx prisma/migrate-owner-fields.ts
//   (ou route admin équivalente, sur le même modèle que /api/admin/seed-methodology)

async function backfill(model: "risk" | "action" | "decision" | "documentRef", label: string) {
  const rows = await (prisma[model] as any).findMany({
    where: { ownerId: null, initiativeId: { not: null } },
    select: { id: true, initiativeId: true },
  });
  for (const row of rows) {
    await (prisma[model] as any).update({
      where: { id: row.id },
      data: { ownerType: "initiative", ownerId: row.initiativeId },
    });
  }
  console.log(`${label} : ${rows.length} enregistrement(s) mis à jour (ownerType=initiative).`);
}

async function main() {
  await backfill("risk", "Risques");
  await backfill("action", "Actions");
  await backfill("decision", "Décisions");
  await backfill("documentRef", "Documents");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
