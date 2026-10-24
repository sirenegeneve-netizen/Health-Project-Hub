import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserAssignments, canGlobally } from "@/lib/authz";

const INVITE_DAYS = 7;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const assignments = await getUserAssignments(user.id);
  if (!(await canGlobally({ id: user.id, assignments }, "gererUtilisateurs"))) {
    return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (target.status === "suspended") return NextResponse.json({ error: "Compte suspendu : réactivez-le avant de générer un lien." }, { status: 409 });

  // Un nouveau lien invalide les précédents encore valides.
  await prisma.inviteToken.updateMany({ where: { userId: params.id, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inviteToken.create({ data: { userId: params.id, token, expiresAt } });

  const inviteUrl = `${req.nextUrl.origin}/invite/${token}`;
  return NextResponse.json({ inviteUrl });
}
