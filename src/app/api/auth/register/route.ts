import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const password = body.password || "";

  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: "Email, nom et mot de passe (8 caractères minimum) sont requis." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const user = await prisma.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
  await createSession(user.id);
  return NextResponse.json({ id: user.id });
}
