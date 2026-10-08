import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { applicableEstablishmentIds, conformiteSummary, isConformiteStatut } from "@/lib/objectifs";

// Applicabilité d'une exigence de référence du GROUPE aux établissements, et suivi local de conformité.
// L'exigence n'est jamais dupliquée : seules des lignes d'applicabilité (par établissement) varient.
async function loadGroupRequirement(id: string) {
  const req = await prisma.qualityRequirement.findUnique({ where: { id }, include: { applicabilities: true } });
  if (!req) return { error: NextResponse.json({ error: "Exigence introuvable." }, { status: 404 }), req: null, establishments: [] as { id: string; name: string }[] };
  if (req.ownerType !== "groupe") {
    return { error: NextResponse.json({ error: "L'applicabilité ne concerne que les exigences de référence du groupe." }, { status: 400 }), req: null, establishments: [] as { id: string; name: string }[] };
  }
  const establishments = await prisma.establishment.findMany({ where: { groupId: req.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return { error: null, req, establishments };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { error, req, establishments } = await loadGroupRequirement(params.id);
  if (error) return error;

  const applicable = new Set(applicableEstablishmentIds(req.portee, req.applicabilities, establishments.map((e) => e.id)));
  const rows = establishments.map((e) => {
    const row = req.applicabilities.find((r) => r.establishmentId === e.id);
    const isApplicable = applicable.has(e.id);
    return {
      establishmentId: e.id,
      name: e.name,
      applicable: isApplicable,
      statutConformite: isApplicable ? row?.statutConformite || "non_evalue" : null,
      evaluation: row?.evaluation || null,
      evaluatedAt: row?.evaluatedAt || null,
      evaluatedBy: row?.evaluatedBy || null,
    };
  });
  return NextResponse.json({
    portee: req.portee,
    establishments: rows,
    synthese: conformiteSummary(rows.filter((r) => r.applicable).map((r) => r.statutConformite as string)),
  });
}

// Définit la portée (« tous » = tout le groupe sauf exclusions ; « selection » = seulement les établissements retenus)
// et l'applicabilité par établissement. Ne touche jamais au statut de conformité ni à l'évaluation déjà saisis.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { error, req: requirement, establishments } = await loadGroupRequirement(params.id);
  if (error) return error;

  const body = await req.json();
  if (body.portee !== undefined && !["tous", "selection"].includes(body.portee)) return NextResponse.json({ error: "Portée invalide (tous | selection)." }, { status: 400 });
  const entries: { establishmentId: string; applicable: boolean }[] = Array.isArray(body.establishments) ? body.establishments : [];
  const valid = new Set(establishments.map((e) => e.id));
  if (entries.some((e) => !valid.has(e.establishmentId) || typeof e.applicable !== "boolean")) {
    return NextResponse.json({ error: "Établissement invalide : il doit appartenir au groupe." }, { status: 400 });
  }

  for (const e of entries) {
    await prisma.requirementApplicability.upsert({
      where: { qualityRequirementId_establishmentId: { qualityRequirementId: requirement.id, establishmentId: e.establishmentId } },
      create: { qualityRequirementId: requirement.id, establishmentId: e.establishmentId, applicable: e.applicable },
      update: { applicable: e.applicable },
    });
  }
  if (body.portee !== undefined && body.portee !== requirement.portee) {
    await prisma.qualityRequirement.update({ where: { id: requirement.id }, data: { portee: body.portee } });
  }
  await logAudit({
    entityType: "exigence",
    entityId: requirement.id,
    entityLabel: requirement.libelle.slice(0, 120),
    action: "update",
    changes: { applicabilite: { from: requirement.portee, to: `${body.portee ?? requirement.portee} (${entries.length} établissement(s) précisé(s))` } },
    user,
  });
  return NextResponse.json({ ok: true });
}

// Évaluation locale d'un établissement : statut de conformité et commentaire d'évaluation.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { error, req: requirement, establishments } = await loadGroupRequirement(params.id);
  if (error) return error;

  const body = await req.json();
  if (!body.establishmentId || !establishments.some((e) => e.id === body.establishmentId)) return NextResponse.json({ error: "Établissement invalide : il doit appartenir au groupe." }, { status: 400 });
  if (body.statutConformite !== undefined && !isConformiteStatut(body.statutConformite)) return NextResponse.json({ error: "Statut de conformité invalide." }, { status: 400 });

  const applicable = applicableEstablishmentIds(requirement.portee, requirement.applicabilities, establishments.map((e) => e.id));
  if (!applicable.includes(body.establishmentId)) return NextResponse.json({ error: "Cette exigence n'est pas applicable à cet établissement." }, { status: 400 });

  const before = requirement.applicabilities.find((r) => r.establishmentId === body.establishmentId);
  const data = {
    statutConformite: body.statutConformite,
    evaluation: body.evaluation === undefined ? undefined : body.evaluation ? String(body.evaluation) : null,
    evaluatedAt: new Date(),
    evaluatedBy: user.name,
  };
  const row = await prisma.requirementApplicability.upsert({
    where: { qualityRequirementId_establishmentId: { qualityRequirementId: requirement.id, establishmentId: body.establishmentId } },
    create: { qualityRequirementId: requirement.id, establishmentId: body.establishmentId, applicable: true, ...data },
    update: data,
  });
  const est = establishments.find((e) => e.id === body.establishmentId);
  if (body.statutConformite !== undefined && body.statutConformite !== (before?.statutConformite || "non_evalue")) {
    await logAudit({ entityType: "exigence", entityId: requirement.id, entityLabel: requirement.libelle.slice(0, 120), action: "update", changes: { [`conformite.${est?.name}`]: { from: before?.statutConformite || "non_evalue", to: body.statutConformite } }, user });
  }
  return NextResponse.json(row);
}
