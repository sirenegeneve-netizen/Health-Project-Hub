import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: { actions: true, risks: true, decisions: true, project: true },
  });
  if (!meeting) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
