import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { registerAuditRisk } from "@/lib/baselineAuditDb";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await registerAuditRisk(params.id, Number(body?.index), { id: user.id, name: user.name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data, { status: res.data.created ? 201 : 200 });
}
