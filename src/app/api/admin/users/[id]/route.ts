import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserAssignments, canGlobally } from "@/lib/authz";
import { logAudit, diffRecords } from "@/lib/audit";

async function assertAdmin(userId: string) {
  const assignments = await getUserAssignments(userId);
  return canGlobally({ id: userId, assignments }, "gererUtilisateurs");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!(await assertAdmin(user.id))) return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { assignments: true, actor: true, inviteTokens: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  return NextResponse.json(target);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!(await assertAdmin(user.id))) return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      telephone: body.telephone !== undefined ? body.telephone : undefined,
      status: body.status ?? undefined,
    },
  });

  await logAudit({
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.name,
    action: "update",
    changes: diffRecords(before, updated),
    user: { id: user.id, name: user.name },
  });
  return NextResponse.json(updated);
}
