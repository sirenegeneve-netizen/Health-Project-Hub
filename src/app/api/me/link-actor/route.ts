import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const actorId: string | null = body.actorId || null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { actorId },
  });
  return NextResponse.json({ actorId: updated.actorId });
}
