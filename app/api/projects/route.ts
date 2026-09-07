import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: { group: true, establishments: { include: { establishment: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { establishmentIds, ...data } = body;

  let groupId = data.groupId as string | undefined;
  if (!groupId) {
    const firstGroup = await prisma.group.findFirst();
    groupId = firstGroup ? firstGroup.id : (await prisma.group.create({ data: { name: "Groupe par défaut" } })).id;
  }

  const project = await prisma.project.create({
    data: {
      reference: data.reference,
      name: data.name,
      description: data.description || null,
      type: data.type || "autre",
      groupId,
      chefDeProjet: data.chefDeProjet || null,
      sponsor: data.sponsor || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      status: data.status || "actif",
      phase: data.phase || "cadrage",
      priority: data.priority || "normale",
      budgetJh: data.budgetJh ? Number(data.budgetJh) : 0,
      budgetInitialEur: data.budgetInitialEur ? Number(data.budgetInitialEur) : null,
      establishments: establishmentIds
        ? { create: (establishmentIds as string[]).map((id) => ({ establishmentId: id })) }
        : undefined,
    },
  });

  if (project.targetDate) {
    await prisma.planningBaseline.create({
      data: { projectId: project.id, label: "Baseline initiale", targetDate: project.targetDate },
    });
  }

  return NextResponse.json(project, { status: 201 });
}
