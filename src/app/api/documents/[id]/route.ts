import { NextRequest } from "next/server";
import { handleDelete } from "@/lib/deletion";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleDelete("document", params.id);
}
