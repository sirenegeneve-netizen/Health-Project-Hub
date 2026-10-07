import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { syncGroupDiffusion } from "@/lib/diffusionDb";

// Crée un Objectif stratégique (identité stable, sans période — la période
// vient du Plan auquel un Cycle de cet objectif sera rattaché).
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

  const goal = await prisma.strategicGoal.create({
    data: { ownerType, ownerId, libelle, description: body.description || null, diffuse: ownerType === "groupe" && body.diffuse === true },
  });
  let diffusion = null;
  if (goal.diffuse) diffusion = await syncGroupDiffusion(ownerId);
  return NextResponse.json({ ...goal, diffusion }, { status: 201 });
}
