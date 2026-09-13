import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const problem = await prisma.problem.create({
    data: {
      initiativeId: body.initiativeId,
      titre: body.titre,
      causeRacine: body.causeRacine || null,
      status: body.status || "investigation",
    },
  });
  return NextResponse.json(problem, { status: 201 });
}
