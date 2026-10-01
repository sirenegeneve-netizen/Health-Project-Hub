import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserAssignments, canGlobally, ROLE_ALLOWED_SCOPES, GLOBAL_SCOPE_ID, Role, ScopeType } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const INVITE_DAYS = 7;

async function scopeLabel(scopeType: string, scopeId: string): Promise<string> {
  if (scopeType === "plateforme") return "Plateforme";
  if (scopeType === "groupe") return (await prisma.group.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Groupe supprimé";
  if (scopeType === "etablissement")
    return (await prisma.establishment.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Établissement supprimé";
  return (await prisma.initiative.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Initiative supprimée";
}

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const assignments = await getUserAssignments(user.id);
  if (!(await canGlobally({ id: user.id, assignments }, "gererUtilisateurs"))) {
    return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: { assignments: true, actor: { select: { fonction: true } } },
    orderBy: { name: "asc" },
  });

  const items = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      fonction: u.actor?.fonction || null,
      lastLoginAt: u.lastLoginAt,
      assignments: await Promise.all(
        u.assignments.map(async (a) => ({ id: a.id, role: a.role, scopeType: a.scopeType, scopeId: a.scopeId, scopeLabel: await scopeLabel(a.scopeType, a.scopeId) }))
      ),
    }))
  );
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const assignments = await getUserAssignments(user.id);
  if (!(await canGlobally({ id: user.id, assignments }, "gererUtilisateurs"))) {
    return NextResponse.json({ error: "Accès réservé à l'administration." }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  if (!email || !name) return NextResponse.json({ error: "Nom et email sont requis." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });

  const newAssignments: { role: Role; scopeType: ScopeType; scopeId: string }[] = (body.assignments || []).filter((a: any) => a.role && a.scopeType);
  for (const a of newAssignments) {
    if (!ROLE_ALLOWED_SCOPES[a.role]?.includes(a.scopeType)) {
      return NextResponse.json({ error: `Le rôle "${a.role}" ne peut pas être affecté à une portée "${a.scopeType}".` }, { status: 400 });
    }
  }

  let actorId: string | null = body.actorId || null;
  if (!actorId && body.actorFonction) {
    const actor = await prisma.actor.create({ data: { name, fonction: body.actorFonction, email, telephone: body.telephone || null } });
    actorId = actor.id;
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      telephone: body.telephone || null,
      actorId,
      status: "invited",
      assignments: {
        create: newAssignments.map((a) => ({ role: a.role, scopeType: a.scopeType, scopeId: a.scopeType === "plateforme" ? GLOBAL_SCOPE_ID : a.scopeId })),
      },
    },
    include: { assignments: true },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inviteToken.create({ data: { userId: created.id, token, expiresAt } });

  await logAudit({ entityType: "user", entityId: created.id, entityLabel: created.name, action: "create", user: { id: user.id, name: user.name } });

  const inviteUrl = `${req.nextUrl.origin}/invite/${token}`;
  return NextResponse.json({ id: created.id, inviteUrl }, { status: 201 });
}
