import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireConfigAccess } from "@/lib/projectConfigAuth";
import { logAudit } from "@/lib/audit";
import { slugifyKey, uniqueKey } from "@/lib/templatePlan";
import { cloneTemplate } from "@/lib/templateEngine";

// Liste des types : par défaut uniquement ceux utilisables à la création (actifs, non archivés).
// ?all=1 : tous (écran d'administration).
export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const all = new URL(req.url).searchParams.get("all") === "1";
  const types = await prisma.projectType.findMany({
    where: all ? {} : { actif: true, archive: false },
    orderBy: [{ ordre: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(types);
}

// Crée un type, ou en duplique un existant (avec les versions actives de ses modèles).
export async function POST(req: NextRequest) {
  const guard = await requireConfigAccess();
  if (guard.error) return guard.error;

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });

  const existingKeys = new Set((await prisma.projectType.findMany({ select: { key: true } })).map((t) => t.key));
  existingKeys.add("defaut");
  const key = uniqueKey(slugifyKey(label), existingKeys);
  const last = await prisma.projectType.findFirst({ orderBy: { ordre: "desc" }, select: { ordre: true } });

  let family = String(body.family || "").trim() || "Autres";
  let description: string | null = body.description ? String(body.description) : null;
  let source: { id: string; key: string; family: string; description: string | null } | null = null;
  if (body.duplicateFromId) {
    source = await prisma.projectType.findUnique({ where: { id: String(body.duplicateFromId) }, select: { id: true, key: true, family: true, description: true } });
    if (!source) return NextResponse.json({ error: "Type source introuvable." }, { status: 404 });
    family = String(body.family || "").trim() || source.family;
    description = description ?? source.description;
  }

  const created = await prisma.projectType.create({
    data: { key, label, family, description, ordre: (last?.ordre ?? 0) + 1, system: false },
  });

  let templatesCopied = 0;
  if (source) {
    const actives = await prisma.projectTemplate.findMany({ where: { typeKey: source.key, status: "actif", isGeneral: false } });
    for (const t of actives) {
      await cloneTemplate(prisma, t.id, { mode: "duplicate", typeKey: key, name: `${label} — ${t.name.split(" — ").slice(1).join(" — ") || "Modèle"}`, status: "actif" });
      templatesCopied++;
    }
  }

  await logAudit({ entityType: "project_type", entityId: created.id, entityLabel: created.label, action: "create", user: guard.user });
  return NextResponse.json({ ...created, templatesCopied }, { status: 201 });
}
