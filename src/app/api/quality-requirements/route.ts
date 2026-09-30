import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Crée une exigence qualité/conformité (référentiel générique, pas un modèle
// par norme). Portée par un Groupe ou un Établissement.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { ownerType, ownerId, referentiel, libelle } = body;
  if (!ownerType || !["groupe", "etablissement"].includes(ownerType)) {
    return NextResponse.json({ error: "ownerType invalide (groupe | etablissement attendu)." }, { status: 400 });
  }
  if (!ownerId || !referentiel || !libelle) {
    return NextResponse.json({ error: "ownerId, referentiel et libelle sont requis." }, { status: 400 });
  }

  const requirement = await prisma.qualityRequirement.create({
    data: {
      ownerType,
      ownerId,
      referentiel,
      code: body.code || null,
      libelle,
      description: body.description || null,
    },
  });
  return NextResponse.json(requirement, { status: 201 });
}
