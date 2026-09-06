import { prisma } from "@/lib/db";
import { NewProjectForm } from "@/components/NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const establishments = await prisma.establishment.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Nouveau projet</h1>
      <NewProjectForm establishments={establishments} />
    </div>
  );
}
