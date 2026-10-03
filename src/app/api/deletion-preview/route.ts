import { NextRequest, NextResponse } from "next/server";
import { DELETE_KINDS, handlePreview, type DeleteKind } from "@/lib/deletion";

// GET /api/deletion-preview?kind=group|establishment|initiative|...&id=...
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") as DeleteKind | null;
  const id = req.nextUrl.searchParams.get("id");
  if (!kind || !id || !DELETE_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }
  return handlePreview(kind, id);
}
