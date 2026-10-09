import { NextRequest, NextResponse } from "next/server";
import { handleDelete } from "@/lib/deletion";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleDelete("document", params.id);
}

// Rattache un document existant (preuve) à un objectif, un indicateur, une action, une exigence ou un constat —
// ou le détache. Le document doit appartenir au même périmètre (groupe / établissement) que l'élément visé.
const LINKABLE = ["objectif", "indicateur", "exigence", "constat"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const doc = await prisma.documentRef.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const body = await req.json();

  // Détachement
  if (body.linkedType === null) {
    const updated = await prisma.documentRef.update({ where: { id: params.id }, data: { linkedType: null, linkedId: null } });
    return NextResponse.json(updated);
  }
  if (!(LINKABLE as readonly string[]).includes(body.linkedType) || !body.linkedId) {
    return NextResponse.json({ error: "linkedType (objectif | indicateur | exigence | constat) et linkedId requis." }, { status: 400 });
  }

  // Périmètre de l'élément visé
  let target: { ownerType: string; ownerId: string } | null = null;
  let label = "";
  if (body.linkedType === "objectif") {
    const c = await prisma.strategicGoalCycle.findUnique({ where: { id: body.linkedId }, include: { strategicGoal: true } });
    target = c ? { ownerType: c.strategicGoal.ownerType, ownerId: c.strategicGoal.ownerId } : null;
    label = c?.strategicGoal.libelle || "";
  } else if (body.linkedType === "indicateur") {
    const i = await prisma.goalIndicator.findUnique({ where: { id: body.linkedId }, include: { strategicGoalCycle: { include: { strategicGoal: true } } } });
    target = i ? { ownerType: i.strategicGoalCycle.strategicGoal.ownerType, ownerId: i.strategicGoalCycle.strategicGoal.ownerId } : null;
    label = i?.nom || "";
  } else if (body.linkedType === "exigence") {
    const q = await prisma.qualityRequirement.findUnique({ where: { id: body.linkedId } });
    target = q ? { ownerType: q.ownerType, ownerId: q.ownerId } : null;
    label = q?.libelle || "";
  } else {
    const f = await prisma.auditFinding.findUnique({ where: { id: body.linkedId } });
    target = f ? { ownerType: f.ownerType, ownerId: f.ownerId } : null;
    label = f?.libelle || "";
  }
  if (!target) return NextResponse.json({ error: "Élément visé introuvable." }, { status: 404 });
  if (target.ownerType !== doc.ownerType || target.ownerId !== doc.ownerId) {
    return NextResponse.json({ error: "Le document doit appartenir au même groupe ou établissement que l'élément visé." }, { status: 400 });
  }

  const updated = await prisma.documentRef.update({ where: { id: params.id }, data: { linkedType: body.linkedType, linkedId: body.linkedId } });
  await logAudit({ entityType: "document", entityId: doc.id, entityLabel: doc.title, action: "update", changes: { rattache_a: { from: null, to: `${body.linkedType} : ${label}`.slice(0, 160) } }, user });
  return NextResponse.json(updated);
}
