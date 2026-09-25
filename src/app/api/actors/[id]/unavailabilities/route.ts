import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: "Dates de début et de fin requises." }, { status: 400 });
  }
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (endDate < startDate) {
    return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
  }

  const period = await prisma.actorUnavailability.create({
    data: { actorId: params.id, startDate, endDate, reason: body.reason || null },
  });
  return NextResponse.json(period, { status: 201 });
}
