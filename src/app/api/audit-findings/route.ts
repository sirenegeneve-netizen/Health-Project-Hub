import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Crée un constat d'audit (écart, observation ou point fort), optionnellement
// lié à une exigence qualité existante. Porté par un Groupe ou un
// Établissement.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { ownerType, ownerId, libelle } = body;
  if (!ownerType || !["groupe", "etablissement"].includes(ownerType)) {
    return NextResponse.json({ error: "ownerType invalide (groupe | etablissement attendu)." }, { status: 400 });
  }
  if (!ownerId || !libelle) {
    return NextResponse.json({ error: "ownerId et libelle sont requis." }, { status: 400 });
  }

  const finding = await prisma.auditFinding.create({
    data: {
      ownerType,
      ownerId,
      qualityRequirementId: body.qualityRequirementId || null,
      type: body.type || "ecart",
      libelle,
      description: body.description || null,
      dateConstat: body.dateConstat ? new Date(body.dateConstat) : new Date(),
      statut: body.statut || "ouvert",
    },
  });
  return NextResponse.json(finding, { status: 201 });
}
