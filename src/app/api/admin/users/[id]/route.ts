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
  // authz-exempt: assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally)
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
  // authz-exempt: assertAdmin : gererUtilisateurs au niveau plateforme (canGlobally)
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!(await assertAdmin(user.id))) return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const body = await req.json();
  // Identité du compte : nom et adresse e-mail modifiables par l'administration (adresse unique, tracée dans le journal).
  let newEmail: string | undefined;
  if (body.email !== undefined) {
    newEmail = String(body.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    if (newEmail !== before.email) {
      const taken = await prisma.user.findUnique({ where: { email: newEmail } });
      if (taken) return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
    } else {
      newEmail = undefined;
    }
  }
  if (body.name !== undefined && !String(body.name).trim()) return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      email: newEmail,
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      telephone: body.telephone !== undefined ? body.telephone : undefined,
      // Réactiver un compte qui n'a jamais défini de mot de passe : il reste « invité » (un lien d'invitation est nécessaire).
      status: body.status === "active" && !before.passwordHash ? "invited" : body.status ?? undefined,
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
