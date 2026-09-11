import { prisma } from "@/lib/db";
import { NewInitiativeForm } from "@/components/NewInitiativeForm";

export const dynamic = "force-dynamic";

export default async function NewInitiativePage() {
  const establishments = await prisma.establishment.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Nouveau projet</h1>
      <NewInitiativeForm establishments={establishments} />
    </div>
  );
}
