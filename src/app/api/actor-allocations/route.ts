import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Une seule route, en upsert : poser 0 ou vide supprime la ligne (case vidée
// dans la heatmap plutôt que ligne à 0 conservée en base).
export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const { actorId, initiativeId, weekStart } = body;
  if (!actorId || !initiativeId || !weekStart) {
    return NextResponse.json({ error: "actorId, initiativeId et weekStart sont requis." }, { status: 400 });
  }
  const joursAlloues = body.joursAlloues === "" || body.joursAlloues === null || body.joursAlloues === undefined ? null : Number(body.joursAlloues);

  if (joursAlloues === null || joursAlloues <= 0 || Number.isNaN(joursAlloues)) {
    await prisma.actorAllocation.deleteMany({ where: { actorId, initiativeId, weekStart: new Date(weekStart) } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const allocation = await prisma.actorAllocation.upsert({
    where: { actorId_initiativeId_weekStart: { actorId, initiativeId, weekStart: new Date(weekStart) } },
    create: { actorId, initiativeId, weekStart: new Date(weekStart), joursAlloues },
    update: { joursAlloues },
  });
  return NextResponse.json(allocation);
}
