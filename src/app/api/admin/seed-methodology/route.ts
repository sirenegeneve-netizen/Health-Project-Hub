import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { METHODOLOGY_GUIDES } from "@/lib/methodologySeedData";

// Déclenchable en visitant l'URL dans le navigateur, même clé que les autres
// routes admin (ADMIN_SEED_KEY, variable d'environnement Vercel).
export async function GET(req: NextRequest) {
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement. Ajoutez-la sur Vercel avant d'utiliser cette route." },
      { status: 503 }
    );
  }
  const providedKey = req.nextUrl.searchParams.get("key");
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Clé invalide ou manquante." }, { status: 401 });
  }

  const summary: { initiativeType: string; items: number }[] = [];
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
    summary.push({ initiativeType, items: seed.items.length });
  }

  return NextResponse.json({ ok: true, guides: summary.length, totalItems, summary });
}
