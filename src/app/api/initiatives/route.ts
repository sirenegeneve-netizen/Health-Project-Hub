import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkflowStages } from "@/lib/workflowStages";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const initiatives = await prisma.initiative.findMany({
    include: { group: true, establishments: { include: { establishment: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(initiatives);
}

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { establishmentIds, ...data } = body;

  const groupId = data.groupId as string | undefined;
  if (!groupId) {
    return NextResponse.json({ error: "groupId est requis — une initiative doit être rattachée à un groupe explicitement choisi." }, { status: 400 });
  }
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Groupe introuvable." }, { status: 404 });

  if (establishmentIds?.length) {
    const count = await prisma.establishment.count({ where: { id: { in: establishmentIds }, groupId } });
    if (count !== establishmentIds.length) {
      return NextResponse.json({ error: "Un ou plusieurs établissements sélectionnés n'appartiennent pas au groupe choisi." }, { status: 400 });
    }
  }

  const initiativeType = data.type || "autre";
  let initialPhase = data.phase;
  if (!initialPhase) {
    const stages = await getWorkflowStages(initiativeType);
    initialPhase = stages[0]?.key || "cadrage";
  }

  const initiative = await prisma.initiative.create({
    data: {
      reference: data.reference,
      name: data.name,
      description: data.description || null,
      type: initiativeType,
      groupId,
      chefDeProjet: data.chefDeProjet || null,
      sponsor: data.sponsor || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      status: data.status || "actif",
      phase: initialPhase,
      priority: data.priority || "normale",
      budgetJh: data.budgetJh ? Number(data.budgetJh) : 0,
      budgetInitialEur: data.budgetInitialEur ? Number(data.budgetInitialEur) : null,
      establishments: establishmentIds
        ? { create: (establishmentIds as string[]).map((id) => ({ establishmentId: id })) }
        : undefined,
    },
  });

  if (initiative.targetDate) {
    await prisma.planningBaseline.create({
      data: { initiativeId: initiative.id, label: "Baseline initiale", targetDate: initiative.targetDate },
    });
  }

  return NextResponse.json(initiative, { status: 201 });
}
