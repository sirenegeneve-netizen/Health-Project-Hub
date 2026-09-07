import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTimelineEvent } from "@/lib/timeline";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      group: true,
      establishments: { include: { establishment: true } },
      actions: { orderBy: { echeance: "asc" } },
      risks: { orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { createdAt: "desc" } },
      interfaces: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { date: "desc" } },
      vigilancePoints: { orderBy: { createdAt: "desc" } },
      anomalies: { orderBy: { createdAt: "desc" } },
      trainings: { include: { establishment: true } },
      timelineEvents: { orderBy: { date: "desc" }, take: 30 },
      baselines: { orderBy: { createdAt: "asc" } },
      backlogItems: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const current = await prisma.project.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Traçabilité §8 : un changement de date cible crée une nouvelle baseline
  // au lieu d'écraser silencieusement le planning.
  if (body.targetDate && current.targetDate && new Date(body.targetDate).getTime() !== current.targetDate.getTime()) {
    await prisma.planningBaseline.create({
      data: {
        projectId: params.id,
        label: `Révision du ${new Date().toLocaleDateString("fr-FR")}`,
        targetDate: new Date(body.targetDate),
        reason: body.planningChangeReason || null,
      },
    });
    await logTimelineEvent(
      params.id,
      "planning",
      `Date cible révisée : ${current.targetDate.toLocaleDateString("fr-FR")} → ${new Date(body.targetDate).toLocaleDateString("fr-FR")}`
    );
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description,
      enjeux: body.enjeux,
      objectifs: body.objectifs,
      perimetre: body.perimetre,
      exclusions: body.exclusions,
      hypotheses: body.hypotheses,
      contraintes: body.contraintes,
      criteresSucces: body.criteresSucces,
      type: body.type,
      chefDeProjet: body.chefDeProjet,
      sponsor: body.sponsor,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      status: body.status,
      phase: body.phase,
      priority: body.priority,
      healthOverride: body.healthOverride,
      budgetJh: body.budgetJh !== undefined ? Number(body.budgetJh) : undefined,
      jhPlanifies: body.jhPlanifies !== undefined ? Number(body.jhPlanifies) : undefined,
      jhConsommes: body.jhConsommes !== undefined ? Number(body.jhConsommes) : undefined,
      budgetInitialEur: body.budgetInitialEur !== undefined ? (body.budgetInitialEur ? Number(body.budgetInitialEur) : null) : undefined,
      budgetReviseEur: body.budgetReviseEur !== undefined ? (body.budgetReviseEur ? Number(body.budgetReviseEur) : null) : undefined,
    },
  });
  return NextResponse.json(project);
}
