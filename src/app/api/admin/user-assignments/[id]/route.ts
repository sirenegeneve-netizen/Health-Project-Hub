import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserAssignments, canGlobally } from "@/lib/authz";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const assignments = await getUserAssignments(user.id);
  if (!(await canGlobally({ id: user.id, assignments }, "gererUtilisateurs"))) {
    return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });
  }

  await prisma.userAssignment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
