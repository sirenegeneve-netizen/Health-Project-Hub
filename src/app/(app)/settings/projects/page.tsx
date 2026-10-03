import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProjectTypesManager } from "@/components/projectConfig/ProjectTypesManager";
import { TemplatesManager } from "@/components/projectConfig/TemplatesManager";
import { StageLibraryManager } from "@/components/projectConfig/StageLibraryManager";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { key: "types", label: "Types de projet" },
  { key: "modeles", label: "Modèles de projet" },
  { key: "etapes", label: "Bibliothèque d'étapes" },
];

export default async function ProjectConfigPage({ searchParams }: { searchParams: { section?: string } }) {
  const section = SECTIONS.some((s) => s.key === searchParams.section) ? searchParams.section! : "types";

  const [types, counts] = await Promise.all([
    prisma.projectType.findMany({ orderBy: [{ ordre: "asc" }, { label: "asc" }] }),
    prisma.initiative.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);
  const countByType = new Map(counts.map((c) => [c.type, c._count._all]));

  return (
    <div>
      <Link href="/settings" className="text-sm text-blue hover:underline">
        ← Paramètres
      </Link>
      <h1 className="font-display text-2xl text-ink mt-2 mb-1">Configuration des projets</h1>
      <p className="text-sm text-muted mb-5 max-w-3xl">
        Un <strong>type</strong> dit quelle est la nature du projet ; un <strong>modèle</strong> dit comment le piloter : parcours, étapes et critères de passage. Une initiative
        reçoit une copie figée du modèle à sa création.
      </p>

      <div className="flex gap-1 border-b border-ink/10 mb-6 text-sm">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={`/settings/projects?section=${s.key}`}
            className={`px-3 py-2 -mb-px border-b-2 ${section === s.key ? "border-primary text-ink font-medium" : "border-transparent text-ink/55 hover:text-ink"}`}
          >
            {s.label}
          </Link>
        ))}
        <span className="px-3 py-2 text-ink/30" title="Prochain lot">
          Livrables · Rôles · Gates (à venir)
        </span>
      </div>

      {types.length === 0 ? (
        <div className="card max-w-2xl text-sm">
          Le référentiel n'est pas encore initialisé. Exécutez une fois la route d'administration{" "}
          <code className="text-xs bg-ink/5 rounded px-1.5 py-0.5">/api/admin/migrate-project-templates?key=…</code> (ajoutez <code className="text-xs bg-ink/5 rounded px-1.5 py-0.5">&dryRun=1</code> pour simuler la migration des
          initiatives sans rien écrire).
        </div>
      ) : section === "types" ? (
        <ProjectTypesManager
          types={types.map((t) => ({
            id: t.id,
            key: t.key,
            label: t.label,
            family: t.family,
            actif: t.actif,
            archive: t.archive,
            system: t.system,
            initiativeCount: countByType.get(t.key) ?? 0,
          }))}
        />
      ) : section === "modeles" ? (
        <TemplatesSection types={types.filter((t) => !t.archive).map((t) => ({ key: t.key, label: t.label }))} />
      ) : (
        <LibrarySection />
      )}
    </div>
  );
}

async function TemplatesSection({ types }: { types: { key: string; label: string }[] }) {
  const templates = await prisma.projectTemplate.findMany({
    include: { _count: { select: { stages: true, initiatives: true } } },
    orderBy: [{ name: "asc" }, { version: "desc" }],
  });
  return (
    <TemplatesManager
      types={types}
      templates={templates.map((t) => ({
        id: t.id,
        typeKey: t.typeKey,
        name: t.name,
        version: t.version,
        status: t.status,
        isGeneral: t.isGeneral,
        stageCount: t._count.stages,
        initiativeCount: t._count.initiatives,
      }))}
    />
  );
}

async function LibrarySection() {
  const defs = await prisma.stageDefinition.findMany({ orderBy: { label: "asc" } });
  return <StageLibraryManager defs={defs.map((d) => ({ id: d.id, key: d.key, label: d.label, objectif: d.objectif, actif: d.actif, system: d.system }))} />;
}
