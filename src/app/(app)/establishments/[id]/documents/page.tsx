import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EstablishmentTabs } from "@/components/EstablishmentTabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentTextImport } from "@/components/DocumentTextImport";

export const dynamic = "force-dynamic";

export default async function EstablishmentDocumentsPage({ params }: { params: { id: string } }) {
  const establishment = await prisma.establishment.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!establishment) notFound();

  const documents = await prisma.documentRef.findMany({
    where: {
      OR: [
        { initiative: { establishments: { some: { establishmentId: params.id } } } },
        { ownerType: "etablissement", ownerId: params.id },
      ],
    },
    include: { initiative: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-4">
        <Link href="/establishments" className="text-sm text-blue hover:underline">
          ← Établissements
        </Link>
      </div>
      <h1 className="font-display text-2xl text-ink mb-1">{establishment.name}</h1>
      <EstablishmentTabs establishmentId={establishment.id} />

      <p className="text-sm text-ink/60 mb-4">
        Documents des initiatives auxquelles cet établissement participe, et documents propres à l'établissement. Un document lié à une
        initiative se dépose depuis celle-ci ; un document propre à l'établissement peut se déposer directement ici.
      </p>

      <div className="card mb-4 space-y-3">
        <DocumentUpload initiativeId="" ownerType="etablissement" ownerId={establishment.id} />
        <DocumentTextImport initiativeId="" ownerType="etablissement" ownerId={establishment.id} />
      </div>

      {documents.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">Aucun document pour cet établissement.</div>
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
                    "Propre à l'établissement"
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
