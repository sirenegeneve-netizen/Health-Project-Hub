import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

// Inscription protégée par un code d'invitation (variable d'env
// REGISTER_INVITE_CODE) — évite d'ouvrir la création de compte à n'importe
// qui sans construire un système d'invitation/rôles complet. Si la variable
// n'est pas configurée, l'inscription est bloquée par défaut (fail closed)
// plutôt que de rester ouverte par erreur.
export async function POST(req: Request) {
  const body = await req.json();
  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const password = body.password || "";
  const inviteCode = (body.inviteCode || "").trim();

  const expectedCode = process.env.REGISTER_INVITE_CODE;
  if (!expectedCode) {
    return NextResponse.json({ error: "La création de compte n'est pas activée sur cette instance." }, { status: 503 });
  }
  if (inviteCode !== expectedCode) {
    return NextResponse.json({ error: "Code d'invitation invalide." }, { status: 403 });
  }

  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: "Email, nom et mot de passe (8 caractères minimum) sont requis." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const user = await prisma.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
  await createSession(user.id);
  return NextResponse.json({ id: user.id });
}
