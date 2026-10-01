import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const token = (body.token || "").trim();
  const password = body.password || "";
  if (!token || password.length < 8) {
    return NextResponse.json({ error: "Lien invalide ou mot de passe trop court (8 caractères minimum)." }, { status: 400 });
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token }, include: { user: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Ce lien d'invitation n'est plus valide. Demandez-en un nouveau à votre administrateur." }, { status: 410 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: invite.userId }, data: { passwordHash: hashPassword(password), status: "active" } }),
    prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);

  await createSession(invite.userId);
  return NextResponse.json({ ok: true });
}
