import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserAssignments, canGlobally } from "@/lib/authz";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/roles";
import { Pill } from "@/components/Pill";

export const dynamic = "force-dynamic";

async function scopeLabel(scopeType: string, scopeId: string): Promise<string> {
  if (scopeType === "plateforme") return "Plateforme";
  if (scopeType === "groupe") return (await prisma.group.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Groupe supprimé";
  if (scopeType === "etablissement")
    return (await prisma.establishment.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Établissement supprimé";
  return (await prisma.initiative.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name || "Initiative supprimée";
}

export default async function AdminUsersPage() {
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

  const users = await prisma.user.findMany({ include: { assignments: true, actor: { select: { fonction: true } } }, orderBy: { name: "asc" } });
  const rows = await Promise.all(
    users.map(async (u) => ({
      ...u,
      assignmentLabels: await Promise.all(
        u.assignments.map(async (a) => `${ROLE_LABELS[a.role as keyof typeof ROLE_LABELS] || a.role} — ${await scopeLabel(a.scopeType, a.scopeId)}`)
      ),
    }))
  );

  const statusTone: Record<string, "ok" | "warn" | "bad"> = { active: "ok", invited: "warn", suspended: "bad" };
  const statusLabel: Record<string, string> = { active: "Actif", invited: "Invité", suspended: "Suspendu" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-ink">Comptes utilisateurs</h1>
        <Link href="/admin/users/new" className="btn">
          + Nouveau compte
        </Link>
      </div>

      {myAssignments.length === 0 && (
        <div className="card mb-4 text-sm text-ink/70">
          Aucune affectation n'existe encore dans l'application — tout compte connecté a donc accès à cette page (mode transitoire). Créez votre
          propre affectation Administrateur ci-dessous pour verrouiller l'accès aux seuls administrateurs.
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="table-hp">
          <thead>
            <tr className="bg-teal-50/50">
              <th className="pl-4">Nom</th>
              <th>Email</th>
              <th>Fonction</th>
              <th>Rôle(s) HPH / périmètre</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="pl-4 text-sm">
                  <Link href={`/admin/users/${u.id}`} className="text-blue hover:underline font-medium">
                    {u.name}
                  </Link>
                </td>
                <td className="text-sm text-muted">{u.email}</td>
                <td className="text-sm text-muted">{u.actor?.fonction || "—"}</td>
                <td className="text-xs">
                  {u.assignmentLabels.length === 0 ? <span className="text-muted">Aucune affectation</span> : u.assignmentLabels.join(" · ")}
                </td>
                <td>
                  <Pill text={statusLabel[u.status] || u.status} tone={statusTone[u.status] || "neutral"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
