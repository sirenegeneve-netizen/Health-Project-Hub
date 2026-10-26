import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeInitialStates } from "@/lib/declinaisonDb";

// Protégée par ADMIN_SEED_KEY, comme les autres routes d'administration. Idempotente, additive : ne renseigne que les déclinaisons
// dont l'état de mise en œuvre est vide (« en cours » si action, mesure, valeur initiale ou responsable, sinon « non pris en charge »).
//   ?key=…                       SIMULATION (par défaut) : compte ce qui serait renseigné, n'écrit rien
//   ?key=…&apply=1               application
//   ?key=…&groupId=…             limite à un groupe (sinon tous les groupes)
export async function GET(req: NextRequest) {
  // authz-exempt: protégé par la clé d'administration (ADMIN_SEED_KEY), simulation par défaut
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement." }, { status: 503 });
  }
  const sp = req.nextUrl.searchParams;
  if (sp.get("key") !== expectedKey) return NextResponse.json({ error: "Clé invalide ou manquante." }, { status: 401 });
  const apply = sp.get("apply") === "1";
  const only = sp.get("groupId");
  const groups = await prisma.group.findMany({ where: only ? { id: only } : {}, select: { id: true, name: true } });
  const out: { groupId: string; name: string; result: any }[] = [];
  for (const g of groups) {
    const r = await computeInitialStates(g.id, !apply, null);
    out.push({ groupId: g.id, name: g.name, result: r.data });
  }
  return NextResponse.json({ ok: true, dryRun: !apply, groups: out });
}
