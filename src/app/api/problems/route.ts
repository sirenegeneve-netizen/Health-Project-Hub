import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { guardCreate } from "@/lib/access";

export async function POST(req: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await req.json();
  const __g = await guardCreate("problem", body);
  if (!__g.ok) return __g.response;

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
