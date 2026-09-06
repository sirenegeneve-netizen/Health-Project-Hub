import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Une cellule de la matrice = un couple (acteur, activité). On upsert son rôle,
// ou on la supprime si role est null — c'est ce qui permet au clic sur une cellule
// de cycler R → A → C → I → (vide) sans jamais créer de doublon.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, actorId, activite, role } = body;

  if (!role) {
    await prisma.raciEntry.deleteMany({ where: { actorId, activite } });
    return NextResponse.json({ ok: true });
  }

  const entry = await prisma.raciEntry.upsert({
    where: { actorId_activite: { actorId, activite } },
    update: { role },
    create: { projectId, actorId, activite, role },
  });
  return NextResponse.json(entry, { status: 201 });
}
