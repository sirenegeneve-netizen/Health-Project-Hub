import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GLOBAL_SCOPE_ID } from "@/lib/authz";

// Déclenchable en visitant l'URL dans le navigateur, protégée par
// ADMIN_SEED_KEY. Nécessaire pour amorcer le système : tant que personne n'a
// de UserAssignment, /admin/users reste accessible à tout compte connecté
// (mode transitoire, cf. src/lib/authz.ts) — cette route crée la première
// affectation administrateur/plateforme pour sortir de ce mode.
export async function GET(req: NextRequest) {
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement." }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (key !== expectedKey) {
    return NextResponse.json({ error: "Clé invalide." }, { status: 403 });
  }
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Paramètre ?email= requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `Aucun compte avec l'email ${email}.` }, { status: 404 });
  }

  const assignment = await prisma.userAssignment.upsert({
    where: { userId_role_scopeType_scopeId: { userId: user.id, role: "administrateur", scopeType: "plateforme", scopeId: GLOBAL_SCOPE_ID } },
    create: { userId: user.id, role: "administrateur", scopeType: "plateforme", scopeId: GLOBAL_SCOPE_ID },
    update: {},
  });
  return NextResponse.json({ ok: true, assignment });
}
