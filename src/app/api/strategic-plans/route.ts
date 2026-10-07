import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { syncGroupDiffusion } from "@/lib/diffusionDb";

// Crée un Plan stratégique (période partagée par plusieurs Objectifs), porté
// par un Groupe ou un Établissement — jamais par une Initiative directement.
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { ownerType, ownerId, libelle, startDate, endDate } = body;
  if (!ownerType || !["groupe", "etablissement"].includes(ownerType)) {
    return NextResponse.json({ error: "ownerType invalide (groupe | etablissement attendu)." }, { status: 400 });
  }
  if (!ownerId || !libelle || !startDate || !endDate) {
    return NextResponse.json({ error: "ownerId, libelle, startDate et endDate sont requis." }, { status: 400 });
  }

  const plan = await prisma.strategicPlan.create({
    data: {
      ownerType,
      ownerId,
      libelle,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      statut: body.statut || "actif",
      // Diffusion aux établissements rattachés : réservée aux plans du groupe.
      diffuse: ownerType === "groupe" && body.diffuse === true,
    },
  });
  let diffusion = null;
  if (plan.diffuse) diffusion = await syncGroupDiffusion(ownerId);
  return NextResponse.json({ ...plan, diffusion }, { status: 201 });
}
