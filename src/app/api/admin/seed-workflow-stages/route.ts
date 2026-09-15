import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WORKFLOWS } from "@/lib/workflowSeedData";

// Déclenchable en visitant l'URL dans le navigateur — pas besoin de terminal.
// Protégée par une clé secrète définie dans les variables d'environnement
// Vercel (ADMIN_SEED_KEY) : sans cette variable, la route refuse tout appel.
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

  const summary: { initiativeType: string; count: number }[] = [];
  let total = 0;
  for (const [initiativeType, stages] of Object.entries(WORKFLOWS)) {
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.workflowStage.upsert({
        where: { initiativeType_key: { initiativeType, key: s.key } },
        create: { initiativeType, ordre: i, key: s.key, label: s.label, legacyPhases: s.legacyPhases || [] },
        update: { ordre: i, label: s.label, legacyPhases: s.legacyPhases || [] },
      });
      total++;
    }
    summary.push({ initiativeType, count: stages.length });
  }

  return NextResponse.json({ ok: true, total, summary });
}
