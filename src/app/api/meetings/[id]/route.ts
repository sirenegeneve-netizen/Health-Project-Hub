import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: { actions: true, risks: true, decisions: true, initiative: true },
  });
  if (!meeting) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const meeting = await prisma.meeting.update({
    where: { id: params.id },
    data: {
      title: body.title ?? undefined,
      agenda: body.agenda ?? undefined,
      notes: body.notes ?? undefined,
      participants: body.participants ?? undefined,
    },
  });
  return NextResponse.json(meeting);
}
