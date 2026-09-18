import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Rattache un Établissement existant à une Initiative (relation many-to-many,
// vue comparative multi-sites). Les deux doivent appartenir au même Groupe —
// pas de rattachement cross-groupe.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { initiativeId, establishmentId } = body;
  if (!initiativeId || !establishmentId) {
    return NextResponse.json({ error: "initiativeId et establishmentId sont requis." }, { status: 400 });
  }

  const [initiative, establishment] = await Promise.all([
    prisma.initiative.findUnique({ where: { id: initiativeId }, select: { groupId: true } }),
    prisma.establishment.findUnique({ where: { id: establishmentId }, select: { groupId: true } }),
  ]);
  if (!initiative || !establishment) {
    return NextResponse.json({ error: "Initiative ou établissement introuvable." }, { status: 404 });
  }
  if (initiative.groupId !== establishment.groupId) {
    return NextResponse.json({ error: "L'établissement n'appartient pas au même groupe que l'initiative." }, { status: 400 });
  }

  try {
    const link = await prisma.initiativeEstablishment.create({
      data: { initiativeId, establishmentId },
      include: { establishment: true },
    });
    return NextResponse.json(link);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Cet établissement est déjà rattaché à l'initiative." }, { status: 409 });
    }
    throw e;
  }
}
