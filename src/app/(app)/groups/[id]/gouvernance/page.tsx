import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GroupTabs } from "@/components/GroupTabs";
import { GroupContacts } from "@/components/GroupContacts";

export const dynamic = "force-dynamic";

export default async function GroupGouvernancePage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: { actorAffiliations: { include: { actor: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!group) notFound();

  const existingActors = await prisma.actor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, distinct: ["name"] });

  return (
    <div>
      <div className="mb-4">
        <Link href="/groups" className="text-sm text-blue hover:underline">
          ← Groupes
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{group.name}</h1>
      <GroupTabs groupId={group.id} />

      <p className="text-sm text-ink/60 mb-4">
        Décideurs, sponsors, interlocuteurs et référents rattachés au groupe (référentiel Acteur partagé avec les établissements et initiatives).
      </p>
      <GroupContacts groupId={group.id} affiliations={group.actorAffiliations} existingActors={existingActors} />
    </div>
  );
}
