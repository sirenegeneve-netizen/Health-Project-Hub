import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Déclenchable en visitant l'URL dans le navigateur — pas besoin de terminal.
// Protégée par ADMIN_SEED_KEY, comme les autres routes admin.
// Backfill ownerType/ownerId sur Risk/Action/Decision/DocumentRef pour les
// enregistrements existants (tous rattachés à une Initiative avant ce lot).
// Idempotent : ne touche que les lignes où ownerId est encore vide.
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

  const summary: Record<string, number> = {};

  const risks = await prisma.risk.findMany({ where: { ownerId: null, initiativeId: { not: null } }, select: { id: true, initiativeId: true } });
  for (const r of risks) await prisma.risk.update({ where: { id: r.id }, data: { ownerType: "initiative", ownerId: r.initiativeId } });
  summary.risks = risks.length;

  const actions = await prisma.action.findMany({ where: { ownerId: null, initiativeId: { not: null } }, select: { id: true, initiativeId: true } });
  for (const a of actions) await prisma.action.update({ where: { id: a.id }, data: { ownerType: "initiative", ownerId: a.initiativeId } });
  summary.actions = actions.length;

  const decisions = await prisma.decision.findMany({ where: { ownerId: null, initiativeId: { not: null } }, select: { id: true, initiativeId: true } });
  for (const d of decisions) await prisma.decision.update({ where: { id: d.id }, data: { ownerType: "initiative", ownerId: d.initiativeId } });
  summary.decisions = decisions.length;

  const documents = await prisma.documentRef.findMany({ where: { ownerId: null, initiativeId: { not: null } }, select: { id: true, initiativeId: true } });
  for (const doc of documents) await prisma.documentRef.update({ where: { id: doc.id }, data: { ownerType: "initiative", ownerId: doc.initiativeId } });
  summary.documents = documents.length;

  return NextResponse.json({ ok: true, summary });
}
