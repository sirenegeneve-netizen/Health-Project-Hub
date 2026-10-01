import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserAssignments, canGlobally } from "@/lib/authz";
import { UserCreateForm } from "@/components/UserCreateForm";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
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

  const [actors, groups, establishments, initiatives] = await Promise.all([
    prisma.actor.findMany({ where: { actif: true }, select: { id: true, name: true, fonction: true }, orderBy: { name: "asc" }, distinct: ["name"] }),
    prisma.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.establishment.findMany({ select: { id: true, name: true, groupId: true }, orderBy: { name: "asc" } }),
    prisma.initiative.findMany({ select: { id: true, name: true, groupId: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/users" className="text-sm text-blue hover:underline">
          ← Comptes utilisateurs
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-4">Nouveau compte</h1>
      <UserCreateForm actors={actors} groups={groups} establishments={establishments} initiatives={initiatives} />
    </div>
  );
}
