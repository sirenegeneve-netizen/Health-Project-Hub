import { NextRequest, NextResponse } from "next/server";
import { migrateObjectifs } from "@/lib/objectifsDb";

// Protégée par ADMIN_SEED_KEY, comme les autres routes d'administration. Additive et idempotente :
// ne supprime ni ne modifie aucun plan, objectif, action, contribution, exigence ou constat existant.
//   ?key=…&dryRun=1   simulation (n'écrit rien) : compte ce qui serait rattaché
//   ?key=…            exécution ; renvoie les comptages avant / après (doivent être identiques)
export async function GET(req: NextRequest) {
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement." }, { status: 503 });
  }
  const sp = req.nextUrl.searchParams;
  if (sp.get("key") !== expectedKey) return NextResponse.json({ error: "Clé invalide ou manquante." }, { status: 401 });
  const summary = await migrateObjectifs({ dryRun: sp.get("dryRun") === "1" });
  return NextResponse.json({ ok: true, ...summary });
}
