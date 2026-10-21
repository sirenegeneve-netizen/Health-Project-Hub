import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildInventory } from "@/lib/authzInventory";
import { authzMode } from "@/lib/accessResolve";

// GET /api/admin/authz-inventory?key=<ADMIN_SEED_KEY>
// Inventaire en LECTURE SEULE des comptes, rôles et affectations, à consulter avant d'activer AUTHZ_MODE=enforce.
export async function GET(req: NextRequest) {
  // authz-exempt: protégé par la clé d'administration (ADMIN_SEED_KEY), lecture seule
  const expectedKey = process.env.ADMIN_SEED_KEY;
  if (!expectedKey) return NextResponse.json({ error: "ADMIN_SEED_KEY n'est pas configurée dans les variables d'environnement." }, { status: 503 });
  if (req.nextUrl.searchParams.get("key") !== expectedKey) return NextResponse.json({ error: "Clé invalide ou manquante." }, { status: 401 });

  const [users, groups, establishments, initiatives] = await Promise.all([
    prisma.user.findMany({ include: { assignments: true, actor: { include: { affiliations: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.group.findMany({ select: { id: true, name: true } }),
    prisma.establishment.findMany({ select: { id: true, name: true } }),
    prisma.initiative.findMany({ select: { id: true, name: true } }),
  ]);
  const report = buildInventory(
    users.map((u) => ({
      id: u.id, email: u.email, name: u.name, status: u.status, lastLoginAt: u.lastLoginAt, actorId: u.actorId,
      assignments: u.assignments.map((a) => ({ id: a.id, role: a.role, scopeType: a.scopeType, scopeId: a.scopeId })),
      affiliations: (u.actor?.affiliations ?? []).map((a) => ({ groupId: a.groupId, establishmentId: a.establishmentId })),
    })),
    groups, establishments, initiatives
  );
  return NextResponse.json({ mode: authzMode(), ...report });
}
