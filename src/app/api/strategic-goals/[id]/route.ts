import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LOCKED_GOAL_FIELDS, lockedFieldsTouched } from "@/lib/diffusion";
import { propagateGoalToChildren, syncGroupDiffusion } from "@/lib/diffusionDb";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const current = await prisma.strategicGoal.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });

  // Copie héritée du groupe : libellé et description suivent l'objectif du groupe.
  const locked = lockedFieldsTouched(!!current.parentGoalId, body, LOCKED_GOAL_FIELDS);
  if (locked.length > 0) {
    return NextResponse.json({ error: "Cet objectif est hérité du groupe : son libellé et sa description se modifient depuis le groupe. La cible et les indicateurs se saisissent dans la déclinaison.", code: "inherited_locked", fields: locked }, { status: 403 });
  }
  if (body.diffuse !== undefined) {
    if (current.ownerType !== "groupe") return NextResponse.json({ error: "Seuls les objectifs du groupe peuvent être diffusés." }, { status: 400 });
    if (body.diffuse === false && current.diffuse) {
      return NextResponse.json({ error: "Une diffusion ne peut pas être retirée (les établissements conservent leur copie)." }, { status: 400 });
    }
  }

  const updated = await prisma.strategicGoal.update({
    where: { id: params.id },
    data: { libelle: body.libelle, description: body.description, diffuse: body.diffuse === true ? true : undefined },
  });
  if (updated.diffuse) {
    await propagateGoalToChildren(updated.id);
    if (body.diffuse === true) await syncGroupDiffusion(updated.ownerId);
  }
  return NextResponse.json(updated);
}
