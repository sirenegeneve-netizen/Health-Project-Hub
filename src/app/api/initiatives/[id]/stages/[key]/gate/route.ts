import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordGateDecision } from "@/lib/stageRuntime";
import { isGateOutcome, GATE_OUTCOME_LABELS } from "@/lib/templatePlan";

// Enregistre une décision de Gate (GO / GO avec réserves / NO GO) : historisée (append-only), reliée à une
// Décision HPH, et fait avancer l'initiative à l'étape suivante si la décision l'autorise.
export async function POST(req: NextRequest, { params }: { params: { id: string; key: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  if (!isGateOutcome(body.outcome)) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  const comment = body.comment ? String(body.comment).trim() : null;
  if (body.outcome !== "go" && !comment) {
    return NextResponse.json({ error: "Un commentaire est requis pour un GO avec réserves ou un NO GO." }, { status: 400 });
  }

  const res = await recordGateDecision({ initiativeId: params.id, stageKey: params.key, outcome: body.outcome, comment, user: { id: user.id, name: user.name } });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const initiative = await prisma.initiative.findUnique({ where: { id: params.id }, select: { name: true } });
  await logAudit({
    entityType: "initiative",
    entityId: params.id,
    entityLabel: initiative?.name || params.id,
    action: "update",
    changes: { [`gate.${params.key}`]: { from: null, to: GATE_OUTCOME_LABELS[body.outcome as keyof typeof GATE_OUTCOME_LABELS] } , ...(res.advancedTo ? { phase: { from: params.key, to: res.advancedTo } } : {}) },
    user,
  });
  return NextResponse.json({ ok: true, advancedTo: res.advancedTo });
}
