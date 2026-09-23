import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GroupTabs } from "@/components/GroupTabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentTextImport } from "@/components/DocumentTextImport";

export const dynamic = "force-dynamic";

export default async function GroupDocumentsPage({ params }: { params: { id: string } }) {
  const group = await prisma.group.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!group) notFound();

  const documents = await prisma.documentRef.findMany({
    where: { OR: [{ initiative: { groupId: params.id } }, { ownerType: "groupe", ownerId: params.id }] },
    include: { initiative: true },
    orderBy: { createdAt: "desc" },
  });

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
        Documents des initiatives du groupe et documents propres au groupe. Un document lié à une initiative se dépose toujours depuis
        celle-ci ; un document propre au groupe (contrat cadre, gouvernance...) peut se déposer directement ici.
      </p>

      <div className="card mb-4 space-y-3">
        <DocumentUpload initiativeId="" ownerType="groupe" ownerId={group.id} />
        <DocumentTextImport initiativeId="" ownerType="groupe" ownerId={group.id} />
      </div>

      {documents.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucun document pour ce groupe.</div>
      ) : (
        <div className="card space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="text-sm border-b border-teal-50 last:border-0 pb-2 last:pb-0 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">
                      {d.title}
                    </a>
                  ) : (
                    d.title
                  )}
                </div>
                <div className="text-xs text-ink/50">
                  {d.type || "document"} ·{" "}
                  {d.initiative ? (
                    <Link href={`/initiatives/${d.initiativeId}/timeline`} className="hover:underline">
                      {d.initiative.name}
                    </Link>
                  ) : (
                    "Propre au groupe"
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
