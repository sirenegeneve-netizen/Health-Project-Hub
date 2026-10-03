import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { migrateExistingInitiatives, seedTemplateEngine } from "@/lib/templateEngine";

// Déclenchable en visitant l'URL dans le navigateur — comme les autres routes admin.
// Protégée par ADMIN_SEED_KEY. Entièrement additive et idempotente : ne supprime ni ne modifie
// aucune donnée existante (types, phases, statuts et coches des critères restent identiques).
//
//   ?key=…                  seed (types, bibliothèque, modèles standards) + migration des initiatives
//   ?key=…&dryRun=1         simulation : compte ce qui serait fait, n'écrit rien (migration seulement)
//   ?key=…&step=seed        seed seul
//   ?key=…&step=migrate     migration seule (le seed doit avoir été exécuté)
//   ?key=…&limit=50         nombre maximum d'initiatives migrées par appel (200 par défaut)
export async function GET(req: NextRequest) {
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement. Ajoutez-la sur Vercel avant d'utiliser cette route." },
      { status: 503 }
    );
  }
  const sp = req.nextUrl.searchParams;
  if (sp.get("key") !== expectedKey) {
    return NextResponse.json({ error: "Clé invalide ou manquante." }, { status: 401 });
  }

  const step = sp.get("step");
  const dryRun = sp.get("dryRun") === "1";
  const limit = sp.get("limit") ? Math.max(1, Number(sp.get("limit"))) : undefined;

  const result: Record<string, unknown> = { ok: true };
  if (step !== "migrate" && !dryRun) result.seed = await seedTemplateEngine(prisma);
  if (step !== "seed") {
    if (dryRun && (await prisma.projectTemplate.count()) === 0) {
      return NextResponse.json({ error: "Aucun modèle en base : exécutez d'abord le seed (sans dryRun)." }, { status: 409 });
    }
    result.migration = await migrateExistingInitiatives({ dryRun, limit });
  }
  return NextResponse.json(result);
}
