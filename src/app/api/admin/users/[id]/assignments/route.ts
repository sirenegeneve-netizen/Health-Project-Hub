import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserAssignments, canGlobally, ROLE_ALLOWED_SCOPES, GLOBAL_SCOPE_ID, Role, ScopeType } from "@/lib/authz";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const assignments = await getUserAssignments(user.id);
  if (!(await canGlobally({ id: user.id, assignments }, "gererUtilisateurs"))) {
    return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });
  }

  const body = await req.json();
  const role: Role = body.role;
  const scopeType: ScopeType = body.scopeType;
  if (!ROLE_ALLOWED_SCOPES[role]?.includes(scopeType)) {
    return NextResponse.json({ error: `Le rôle "${role}" ne peut pas être affecté à une portée "${scopeType}".` }, { status: 400 });
  }
  const scopeId = scopeType === "plateforme" ? GLOBAL_SCOPE_ID : body.scopeId;
  if (!scopeId) return NextResponse.json({ error: "scopeId requis pour cette portée." }, { status: 400 });

  try {
    const created = await prisma.userAssignment.create({ data: { userId: params.id, role, scopeType, scopeId } });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Cette affectation existe déjà." }, { status: 409 });
    throw e;
  }
}
