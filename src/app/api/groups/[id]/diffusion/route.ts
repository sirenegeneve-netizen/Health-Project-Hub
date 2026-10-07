import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncGroupDiffusion } from "@/lib/diffusionDb";

// « Resynchroniser » : complète les plans, objectifs et déclinaisons manquants dans les établissements du
// groupe. Idempotent ; ne modifie jamais la cible, les indicateurs ou le statut saisis par un établissement.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const group = await prisma.group.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });

  const summary = await syncGroupDiffusion(group.id);
  await logAudit({
    entityType: "group",
    entityId: group.id,
    entityLabel: group.name,
    action: "update",
    changes: { diffusion_objectifs: { from: null, to: `${summary.plansCreated} plan(s), ${summary.goalsCreated} objectif(s), ${summary.cyclesCreated} déclinaison(s)` } },
    user,
  });
  return NextResponse.json(summary);
}
