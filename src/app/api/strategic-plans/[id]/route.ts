import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LOCKED_PLAN_FIELDS, lockedFieldsTouched } from "@/lib/diffusion";
import { propagatePlanToChildren, syncGroupDiffusion } from "@/lib/diffusionDb";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const current = await prisma.strategicPlan.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Plan introuvable." }, { status: 404 });

  // Copie héritée du groupe : libellé, dates et statut suivent le plan du groupe.
  const locked = lockedFieldsTouched(!!current.parentPlanId, body, LOCKED_PLAN_FIELDS);
  if (locked.length > 0) {
    return NextResponse.json({ error: "Ce plan est hérité du groupe : son libellé, ses dates et son statut se modifient depuis le groupe.", code: "inherited_locked", fields: locked }, { status: 403 });
  }
  if (body.diffuse !== undefined) {
    if (current.ownerType !== "groupe") return NextResponse.json({ error: "Seuls les plans du groupe peuvent être diffusés." }, { status: 400 });
    if (body.diffuse === false && current.diffuse) {
      return NextResponse.json({ error: "Une diffusion ne peut pas être retirée (les établissements conservent leur copie)." }, { status: 400 });
    }
  }

  const updated = await prisma.strategicPlan.update({
    where: { id: params.id },
    data: {
      libelle: body.libelle,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      statut: body.statut,
      diffuse: body.diffuse === true ? true : undefined,
    },
  });
  if (updated.diffuse) {
    await propagatePlanToChildren(updated.id);
    if (body.diffuse === true) await syncGroupDiffusion(updated.ownerId);
  }
  return NextResponse.json(updated);
}
