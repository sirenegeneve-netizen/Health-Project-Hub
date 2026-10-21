import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";

export async function POST() {
  // authz-exempt: ne concerne que la session de l'appelant
  await destroyCurrentSession();
  return NextResponse.json({ ok: true });
}
