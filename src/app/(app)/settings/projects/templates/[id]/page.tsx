import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AUTO_SOURCES, canEditInPlace } from "@/lib/templatePlan";
import { TemplateEditor } from "@/components/projectConfig/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({ params }: { params: { id: string } }) {
  const template = await prisma.projectTemplate.findUnique({
    where: { id: params.id },
    include: {
      stages: { include: { criteria: { orderBy: { order: "asc" } }, items: { orderBy: { order: "asc" } } }, orderBy: { position: "asc" } },
      _count: { select: { initiatives: true } },
    },
  });
  if (!template) notFound();

  const [type, library] = await Promise.all([
    prisma.projectType.findUnique({ where: { key: template.typeKey }, select: { label: true } }),
    prisma.stageDefinition.findMany({ where: { actif: true }, orderBy: { label: "asc" }, select: { key: true, label: true } }),
  ]);
  const locked = !canEditInPlace(template, template._count.initiatives);

  return (
    <div>
      <Link href="/settings/projects?section=modeles" className="text-sm text-blue hover:underline">
        ← Modèles de projet
      </Link>
      <div className="mt-3">
        <TemplateEditor
          locked={locked}
          library={library}
          autoSources={Object.entries(AUTO_SOURCES).map(([key, v]) => ({ key, label: v.label }))}
          template={{
            id: template.id,
            name: template.name,
            version: template.version,
            status: template.status,
            isGeneral: template.isGeneral,
            typeLabel: type?.label || template.typeKey,
            initiativeCount: template._count.initiatives,
            stages: template.stages.map((s) => ({
              id: s.id,
              key: s.key,
              label: s.label,
              objectif: s.objectif,
              obligatoire: s.obligatoire,
              active: s.active,
              gateMode: s.gateMode,
              criteria: s.criteria.map((c) => ({ id: c.id, label: c.label, obligatoire: c.obligatoire, mode: c.mode, autoSource: c.autoSource })),
              items: s.items.map((it) => ({ id: it.id, kind: it.kind, label: it.label, obligatoire: it.obligatoire })),
            })),
          }}
        />
      </div>
    </div>
  );
}
