import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserAssignments, canGlobally } from "@/lib/authz";
import { UserDetailPanel } from "@/components/UserDetailPanel";

export const dynamic = "force-dynamic";

async function scopeLabel(scopeType: string, scopeId: string): Promise<string> {
  if (scopeType === "plateforme") return "Plateforme";
  if (scopeType === "groupe") return (await prisma.group.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Groupe supprimé";
  if (scopeType === "etablissement")
    return (await prisma.establishment.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Établissement supprimé";
  return (await prisma.initiative.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Initiative supprimée";
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return null;
  const myAssignments = await getUserAssignments(me.id);
  const allowed = await canGlobally({ id: me.id, assignments: myAssignments }, "gererUtilisateurs");
  if (!allowed) {
    return (
      <div className="card max-w-md">
        <p className="text-sm text-ink">Cette page est réservée à l'administration.</p>
      </div>
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { assignments: true, actor: true, inviteTokens: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!target) notFound();

  const [groups, establishments, initiatives] = await Promise.all([
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.establishment.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.initiative.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const assignments = await Promise.all(
    target.assignments.map(async (a) => ({
      id: a.id,
      role: a.role as any,
      scopeType: a.scopeType as any,
      scopeId: a.scopeId,
      scopeLabel: await scopeLabel(a.scopeType, a.scopeId),
    }))
  );

  const latestInvite = target.inviteTokens[0];
  let latestInviteUrl: string | null = null;
  if (latestInvite && !latestInvite.usedAt && latestInvite.expiresAt > new Date()) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
    latestInviteUrl = `${origin}/invite/${latestInvite.token}`;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/users" className="text-sm text-blue hover:underline">
          ← Comptes utilisateurs
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{target.name}</h1>
      <p className="text-sm text-muted mb-1">{target.email}</p>
      {target.actor?.fonction && <p className="text-sm text-muted mb-6">{target.actor.fonction}</p>}
      {!target.actor?.fonction && <div className="mb-6" />}

      <UserDetailPanel
        userId={target.id}
        status={target.status}
        assignments={assignments}
        groups={groups}
        establishments={establishments}
        initiatives={initiatives}
        latestInviteUrl={latestInviteUrl}
      />
    </div>
  );
}
